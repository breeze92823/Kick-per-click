import { BackSide, DoubleSide, Color, DirectionalLight, Fog, Group, HemisphereLight, Mesh, Path, ShaderMaterial, Shape, ShapeGeometry, SphereGeometry, Vector2, Vector3 } from 'three'
import { ARENA, COLORS, FOG, GROUND_SIZE, GROUND_Y, LIGHT, SKY } from './config.js'
import { groundMaterial } from './materials.js'

// Stud-plate UVs follow world position so the hub and the sunken lane tile alike.
function worldUVs(geo) {
  const pos = geo.attributes.position
  const uv = geo.attributes.uv
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + GROUND_SIZE / 2) / GROUND_SIZE, (pos.getY(i) + GROUND_SIZE / 2) / GROUND_SIZE)
  return geo
}

// The hub ground has a hole where the kick lane runs; the lane floor sits `drop` lower.
export function createGround() {
  const { maxZ, lane } = ARENA
  const h = GROUND_SIZE / 2
  // Runs south past the lane end so the hub-level ground flanks the whole lane (the square alone stops at z = h).
  const south = Math.max(h, lane.endZ + 60)
  const shape = new Shape([new Vector2(-h, -south), new Vector2(h, -south), new Vector2(h, h), new Vector2(-h, h)])
  // Rotated -90deg about X, shape y becomes world -z.
  shape.holes.push(new Path([new Vector2(lane.minX, -maxZ), new Vector2(lane.minX, -lane.endZ), new Vector2(lane.maxX, -lane.endZ), new Vector2(lane.maxX, -maxZ)]))
  const mat = groundMaterial()
  const hub = new Mesh(worldUVs(new ShapeGeometry(shape)), mat)
  const floorMat = mat.clone()
  floorMat.side = DoubleSide
  const floor = new Mesh(worldUVs(new ShapeGeometry(new Shape([new Vector2(lane.minX, -lane.endZ), new Vector2(lane.maxX, -lane.endZ), new Vector2(lane.maxX, -maxZ), new Vector2(lane.minX, -maxZ)]))), floorMat)
  floor.position.y = -lane.drop
  const group = new Group()
  for (const m of [hub, floor]) {
    m.rotation.x = -Math.PI / 2
    m.receiveShadow = true
    group.add(m)
  }
  hub.position.y = GROUND_Y
  floor.position.y = GROUND_Y - lane.drop
  return group
}

// Cartoon sky dome: blue gradient, two rainbows rising off the horizon, fbm clouds
// and a sun disc in the lighting direction. Keep it centred on the camera.
const SKY_FRAGMENT = /* glsl */ `
uniform vec3 top;
uniform vec3 mid;
uniform vec3 bottom;
uniform vec3 sunDir;
uniform float cloudScale;
uniform float cloudCover;
varying vec3 vDir;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
  return s;
}
vec3 hue(float t) {
  return clamp(abs(mod(t * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}
vec3 rainbow(vec3 col, vec3 d, vec3 axis, float radius, float width) {
  float a = acos(clamp(dot(d, axis), -1.0, 1.0));
  float t = (a - radius) / width;
  if (t <= 0.0 || t >= 1.0) return col;
  float fade = sin(t * 3.14159) * smoothstep(-0.02, 0.15, d.y);
  return mix(col, hue(0.8 * t), 0.5 * fade);
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(bottom, mid, smoothstep(-0.02, 0.25, h));
  col = mix(col, top, smoothstep(0.25, 0.9, h));
  col = rainbow(col, d, normalize(vec3(0.3, -0.35, -1.0)), 0.95, 0.16);
  col = rainbow(col, d, normalize(vec3(-0.5, -0.3, 0.9)), 0.9, 0.16);

  float sd = max(dot(d, sunDir), 0.0);
  col += vec3(1.0, 0.97, 0.9) * (smoothstep(0.9993, 0.9996, sd) * 2.0 + pow(sd, 48.0) * 0.35);

  if (h > -0.05) {
    vec2 uv = d.xz / (h + 0.2) * cloudScale;
    float n = fbm(vec3(uv, 0.0));
    float c = smoothstep(cloudCover, cloudCover + 0.22, n) * smoothstep(-0.02, 0.18, h);
    float bank = smoothstep(0.52, 0.66, fbm(vec3(d.x * 4.0, h * 9.0, d.z * 4.0))) * (1.0 - smoothstep(0.03, 0.24, h));
    c = max(c, bank * 0.95);
    vec3 cloud = mix(vec3(0.78, 0.8, 1.0), vec3(1.0), smoothstep(cloudCover, cloudCover + 0.3, n));
    col = mix(col, cloud, c);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`

export function createSky() {
  const sun = new Vector3(...LIGHT.sunPosition).normalize()
  const mesh = new Mesh(
    new SphereGeometry(SKY.radius, 48, 24),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new Color(COLORS.zenith) },
        mid: { value: new Color(COLORS.skyMid) },
        bottom: { value: new Color(COLORS.horizon) },
        sunDir: { value: sun },
        cloudScale: { value: SKY.cloudScale },
        cloudCover: { value: SKY.cloudCover },
      },
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: SKY_FRAGMENT,
    }),
  )
  mesh.renderOrder = -1
  mesh.frustumCulled = false
  return mesh
}

export const createFog = () => new Fog(COLORS.horizon, FOG.near, FOG.far)

// Hemisphere fill + one shadow-casting sun. The sun's shadow box follows the
// player so a small map covers the whole play area at full resolution. The
// follow point snaps to shadow texels so shadows do not shimmer while moving.
export function createLights() {
  const hemi = new HemisphereLight(LIGHT.hemiSky, LIGHT.hemiGround, LIGHT.hemiIntensity)
  const sun = new DirectionalLight(LIGHT.sunColor, LIGHT.sunIntensity)
  const offset = { x: LIGHT.sunPosition[0], y: LIGHT.sunPosition[1], z: LIGHT.sunPosition[2] }
  sun.castShadow = true
  sun.shadow.mapSize.set(LIGHT.shadowMapSize, LIGHT.shadowMapSize)
  const r = LIGHT.shadowRange
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 150 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03

  const texel = (2 * r) / LIGHT.shadowMapSize
  const snap = (v) => Math.round(v / texel) * texel
  const follow = (x, z) => {
    const sx = snap(x)
    const sz = snap(z)
    sun.position.set(sx + offset.x, offset.y, sz + offset.z)
    sun.target.position.set(sx, 0, sz)
    sun.target.updateMatrixWorld()
  }
  follow(0, 0)
  return { hemi, sun, follow }
}
