// Kick juice: additive spark/dust particles and the glowing "BOUNCE!" rings that
// randomly appear on the ball's path. Flying through a ring boosts the ball.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
} from 'three'
import { KICKBALL as K } from './config.js'
import { makeLabel } from './labels.js'
import { floorAt } from './player.js'
import { makeCanvas } from './textures.js'

const MAX = 480
const rand = (a, b) => a + Math.random() * (b - a)

// Soft dot with a small four-point glint, used for every particle.
function sparkTexture() {
  const c = makeCanvas(64, 64)
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.7)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  g.fillStyle = 'rgba(255,255,255,0.8)'
  g.beginPath()
  g.moveTo(32, 2); g.lineTo(36, 28); g.lineTo(62, 32); g.lineTo(36, 36)
  g.lineTo(32, 62); g.lineTo(28, 36); g.lineTo(2, 32); g.lineTo(28, 28)
  g.closePath()
  g.fill()
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

// Chunky white up-arrow under the ring's label.
function arrowTexture() {
  const c = makeCanvas(96, 96)
  const g = c.getContext('2d')
  g.lineJoin = 'round'
  g.beginPath()
  g.moveTo(48, 8); g.lineTo(88, 52); g.lineTo(64, 52); g.lineTo(64, 88)
  g.lineTo(32, 88); g.lineTo(32, 52); g.lineTo(8, 52)
  g.closePath()
  g.fillStyle = '#ffffff'
  g.fill()
  g.lineWidth = 7
  g.strokeStyle = '#1b3a6a'
  g.stroke()
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

export function createKickFx(scene) {
  // --- Particles (one Points draw call, ring-buffer slots) ---------------------
  const pos = new Float32Array(MAX * 3)
  const col = new Float32Array(MAX * 3)
  const vel = new Float32Array(MAX * 3)
  const base = new Float32Array(MAX * 3) // colour at full life
  const life = new Float32Array(MAX)
  const maxLife = new Float32Array(MAX).fill(1)
  const grav = new Float32Array(MAX)
  let next = 0
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('color', new BufferAttribute(col, 3))
  const points = new Points(
    geo,
    new PointsMaterial({
      size: 0.55,
      map: sparkTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      sizeAttenuation: true,
    }),
  )
  points.frustumCulled = false
  scene.add(points)
  pos.fill(-9999)

  function emit(x, y, z, vx, vy, vz, l, r, g, b, gr = 0) {
    const i = next
    next = (next + 1) % MAX
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz
    base[i * 3] = r; base[i * 3 + 1] = g; base[i * 3 + 2] = b
    life[i] = maxLife[i] = l
    grav[i] = gr
  }

  function burst(p, n, { speed = 6, up = 2, life: l = 0.6, color = [1, 1, 1], gravity = 8, spread = 0.2 } = {}) {
    for (let k = 0; k < n; k++) {
      const a = rand(0, Math.PI * 2)
      const u = rand(-1, 1)
      const s = speed * rand(0.4, 1)
      const r = Math.sqrt(1 - u * u)
      const m = rand(0.7, 1)
      emit(p.x + rand(-spread, spread), p.y + rand(-spread, spread), p.z + rand(-spread, spread), Math.cos(a) * r * s, u * s + up, Math.sin(a) * r * s, l * rand(0.6, 1.2), color[0] * m, color[1] * m, color[2] * m, gravity)
    }
  }

  // --- Bounce rings -------------------------------------------------------------
  const rings = []
  const arrowTex = arrowTexture()
  const R = K.ringRadius
  const coreGeo = new TorusGeometry(R, 0.2, 14, 56)
  const glowGeo = new TorusGeometry(R, 0.42, 10, 56)
  const discGeo = new CircleGeometry(R, 40)
  const labelProto = makeLabel([{ text: 'BOUNCE!', px: 44, fill: 'white', stroke: '#0b3d78' }], { scale: 0.022 })

  function makeRing(x, y, z) {
    const group = new Group()
    const core = new Mesh(coreGeo, new MeshBasicMaterial({ color: '#3de8ff', transparent: true, toneMapped: false }))
    const glow = new Mesh(glowGeo, new MeshBasicMaterial({ color: '#2a9bff', transparent: true, opacity: 0.28, blending: AdditiveBlending, depthWrite: false, toneMapped: false }))
    const disc = new Mesh(discGeo, new MeshBasicMaterial({ color: '#35d8ff', transparent: true, opacity: 0.2, side: DoubleSide, depthWrite: false, toneMapped: false }))
    const label = new Sprite(labelProto.material.clone())
    label.center.copy(labelProto.center)
    label.scale.copy(labelProto.scale)
    label.position.set(0, -0.05, 0.1)
    const arrow = new Sprite(new SpriteMaterial({ map: arrowTex, transparent: true, depthWrite: false }))
    arrow.scale.set(0.9, 0.9, 1)
    arrow.position.set(0, -0.7, 0.1)
    group.add(disc, glow, core, label, arrow)
    group.position.set(x, y, z)
    group.scale.setScalar(0.01)
    scene.add(group)
    const ring = { group, core, glow, disc, arrow, x, y, z, age: 0, state: 'in', fade: 1 }
    rings.push(ring)
    return ring
  }

  function disposeRing(ring) {
    scene.remove(ring.group)
    ring.group.traverse((o) => o.material?.dispose()) // geometries and textures are shared
  }

  // Ball position under gravity `g` after t seconds.
  const at = (p, v, g, t) => ({ x: p.x + v.x * t, y: p.y + v.y * t - 0.5 * g * t * t, z: p.z + v.z * t })

  // Maybe drop a ring on the ball's predicted path. Returns whether one appeared.
  function maybeSpawnRing(p, v, chance = K.ringChance) {
    if (Math.random() > chance) return false
    const g = K.gravity
    const floor0 = floorAt(p.x, p.z + v.z * 0.5, p.y)
    const T = (v.y + Math.sqrt(Math.max(0, v.y * v.y + 2 * g * (p.y - floor0 - K.radius)))) / g
    const spots = []
    for (let i = 0; i < 10; i++) {
      const t = T * rand(0.22, 0.66)
      const q = at(p, v, g, t)
      const gf = floorAt(q.x, q.z, q.y)
      if (q.y - gf >= R + 0.5 && q.z - p.z >= 4) spots.push(q)
    }
    if (!spots.length) return false
    const q = spots[Math.floor(Math.random() * spots.length)]
    makeRing(q.x + rand(-0.25, 0.25), q.y, q.z)
    return true
  }

  // Did the ball (prev -> cur) fly through a live ring? Returns that ring or null.
  function passRing(prev, cur) {
    for (const ring of rings) {
      if (ring.state === 'hit' || ring.state === 'out') continue
      if (prev.z >= ring.z || cur.z < ring.z) continue
      const f = (ring.z - prev.z) / (cur.z - prev.z)
      const dx = prev.x + (cur.x - prev.x) * f - ring.x
      const dy = prev.y + (cur.y - prev.y) * f - ring.y
      if (Math.hypot(dx, dy) < R + K.radius * 0.5) return ring
    }
    return null
  }

  function hitRing(ring) {
    ring.state = 'hit'
    ring.age = 0
    const p = { x: ring.x, y: ring.y, z: ring.z }
    burst(p, 46, { speed: 9, up: 1, life: 0.7, color: [0.4, 0.95, 1], gravity: 2, spread: R * 0.5 })
    burst(p, 18, { speed: 5, up: 3, life: 0.8, color: [1, 1, 1], gravity: 4 })
  }

  // Rings still waiting fade out (the ball landed or missed them).
  function clearRings() {
    for (const r of rings) if (r.state === 'in' || r.state === 'idle') r.state = 'out'
  }

  function updateRings(dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]
      r.age += dt
      let s = 1
      let a = 1
      if (r.state === 'in') {
        const t = Math.min(1, r.age / 0.28)
        s = t < 1 ? 1 - Math.pow(1 - t, 3) * Math.cos(t * 9) : 1 // pop with overshoot
        if (t >= 1) r.state = 'idle'
      }
      if (r.state === 'idle') s = 1 + Math.sin(r.age * 7) * 0.035
      if (r.state === 'hit') {
        const t = r.age / 0.4
        s = 1 + t * 0.9
        a = 1 - t
        if (t >= 1) { disposeRing(r); rings.splice(i, 1); continue }
      } else if (r.state === 'out') {
        a = Math.max(0, 1 - r.age / 0.5)
        r.fade = Math.min(r.fade, a)
        if (a <= 0) { disposeRing(r); rings.splice(i, 1); continue }
        a = r.fade
      }
      r.group.scale.setScalar(Math.max(0.01, s))
      r.core.material.opacity = a
      r.glow.material.opacity = 0.28 * a * (0.8 + 0.2 * Math.sin(r.age * 9))
      r.disc.material.opacity = 0.2 * a
      r.arrow.material.opacity = a
      r.arrow.position.y = -0.7 + Math.sin(r.age * 8) * 0.08
      if (r.state === 'out' || r.state === 'hit') r.group.children[3].material.opacity = a
    }
  }

  function update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) {
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0
        continue
      }
      life[i] -= dt
      vel[i * 3 + 1] -= grav[i] * dt
      pos[i * 3] += vel[i * 3] * dt
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt
      const f = Math.max(0, life[i] / maxLife[i])
      col[i * 3] = base[i * 3] * f
      col[i * 3 + 1] = base[i * 3 + 1] * f
      col[i * 3 + 2] = base[i * 3 + 2] * f
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
    updateRings(dt)
  }

  return {
    update,
    maybeSpawnRing,
    passRing,
    hitRing,
    clearRings,
    // The impact at the foot: a white/gold spark burst.
    kickBurst(p) {
      burst(p, 34, { speed: 8, up: 1.5, life: 0.5, color: [1, 0.95, 0.6], gravity: 6 })
      burst(p, 12, { speed: 4, up: 2, life: 0.7, color: [1, 1, 1], gravity: 3 })
    },
    // Fading sparks behind the flying ball; cyan once it has bounced.
    trail(p, boosted) {
      const c = boosted ? [0.3, 0.9, 1] : [1, 0.92, 0.55]
      for (let k = 0; k < 2; k++) emit(p.x + rand(-0.12, 0.12), p.y + rand(-0.12, 0.12), p.z - 0.2, rand(-0.5, 0.5), rand(-0.3, 0.8), rand(-1.5, 0), rand(0.35, 0.6), c[0], c[1], c[2], 0)
    },
    // Boost trail: a wider fan of cyan streaks.
    boostBurst(p) {
      burst(p, 26, { speed: 7, up: 1, life: 0.55, color: [0.4, 0.95, 1], gravity: 2, spread: 0.3 })
    },
    landBurst(p, groundY) {
      const q = { x: p.x, y: groundY + 0.1, z: p.z }
      burst(q, 30, { speed: 5, up: 3, life: 0.7, color: [0.55, 0.85, 0.2], gravity: 12, spread: 0.4 })
      burst(q, 16, { speed: 4, up: 4, life: 0.8, color: [1, 0.95, 0.5], gravity: 10, spread: 0.3 })
    },
  }
}
