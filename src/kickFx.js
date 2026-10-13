// Kick juice: additive spark/dust particles and the glowing "BOUNCE!" rings planned
// along the ball's path (kickPlan.js). Flying through a ring boosts the ball.
import {
  AdditiveBlending,
  BufferAttribute,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  RingGeometry,
  CylinderGeometry,
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
  Vector3,
} from 'three'
import { KICKBALL as K } from './config.js'
import { makeLabel } from './labels.js'
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
// The HUD's Wins trophy (same drawing as hud.js ICON.trophy), painted onto the Bonus Win ring.
const TROPHY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M18 14 H8 C8 27 14 31 21 31 M46 14 H56 C56 27 50 31 43 31" fill="none" stroke="#5a3a06" stroke-width="9" stroke-linecap="round"/><path d="M18 14 H8 C8 27 14 31 21 31 M46 14 H56 C56 27 50 31 43 31" fill="none" stroke="#ffc21a" stroke-width="4" stroke-linecap="round"/><path d="M16 6 H48 V24 A16 16 0 0 1 16 24Z" fill="#ffc21a" stroke="#5a3a06" stroke-width="4" stroke-linejoin="round"/><path d="M22 10 V22" stroke="#fff3a0" stroke-width="4" stroke-linecap="round"/><rect x="27" y="39" width="10" height="10" fill="#e8a010" stroke="#5a3a06" stroke-width="3.5"/><rect x="16" y="49" width="32" height="11" rx="3" fill="#ffc21a" stroke="#5a3a06" stroke-width="4"/></svg>`

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

  // --- Air wake: a translucent cone streaming back from the ball, as if it were
  // piercing the air. Narrow and bright at the ball, wide and faded behind. -------
  const wakeGeo = new CylinderGeometry(K.radius * 0.85, K.radius * 1.5, 1, 28, 1, true)
  wakeGeo.translate(0, -0.5, 0) // narrow end at the origin, body along -Y
  {
    const n = wakeGeo.attributes.position.count
    const c = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      c[i * 4] = c[i * 4 + 1] = c[i * 4 + 2] = 1
      c[i * 4 + 3] = wakeGeo.attributes.position.getY(i) < -0.5 ? 0 : 0.6 // far end fades out
    }
    wakeGeo.setAttribute('color', new BufferAttribute(c, 4))
  }
  const wakeMat = new MeshBasicMaterial({ color: '#e4ffec', vertexColors: true, transparent: true, opacity: 0.8, side: DoubleSide, depthWrite: false, toneMapped: false })
  const wake = new Mesh(wakeGeo, wakeMat)
  wake.visible = false
  wake.frustumCulled = false
  scene.add(wake)
  const wakeDir = new Vector3()
  const UP = new Vector3(0, 1, 0)
  let wakeAge = 1

  // --- Landing debris: stud chunks thrown out round the ball, a shockwave ring and a glow. They last until
  // clearCrater() (the ball resets), then shrink away. Built once and reused. ---
  const C = K.crater
  const chunks = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0 }), C.chunks)
  chunks.castShadow = true
  chunks.receiveShadow = true
  chunks.frustumCulled = false
  chunks.visible = false
  scene.add(chunks)
  const shock = new Mesh(new RingGeometry(0.85, 1, 48), new MeshBasicMaterial({ color: '#9ff4ff', transparent: true, side: DoubleSide, blending: AdditiveBlending, depthWrite: false, toneMapped: false }))
  shock.rotation.x = -Math.PI / 2
  shock.visible = false
  scene.add(shock)
  const aura = new Sprite(new SpriteMaterial({ map: sparkTexture(), color: '#38d8ff', transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }))
  aura.visible = false
  scene.add(aura)
  const crater = { on: false, age: 0, out: -1, x: 0, y: 0, z: 0, R: 1, pieces: [] }
  const tmp = new Object3D()
  const tint = new Color()
  function spawnCrater(p, groundY) {
    const R = C.debrisRadius
    Object.assign(crater, { on: true, age: 0, out: -1, x: p.x, y: groundY, z: p.z, R })
    crater.pieces = []
    for (let i = 0; i < C.chunks; i++) {
      const a = (i / C.chunks) * Math.PI * 2 + rand(-0.2, 0.2)
      const s = rand(C.chunkSize[0], C.chunkSize[1])
      const d = R + s + rand(0.05, C.debrisSpread)
      crater.pieces.push({
        dx: Math.cos(a) * d, dz: Math.sin(a) * d, dy: s * 0.3,
        sx: s, sy: s * rand(0.5, 0.9), sz: s * rand(0.8, 1.2),
        rx: rand(-0.7, 0.7), ry: rand(0, Math.PI), rz: rand(-0.7, 0.7),
        delay: rand(0, 0.06),
      })
      tint.set(C.colors[i % C.colors.length]).multiplyScalar(rand(0.85, 1.05))
      chunks.setColorAt(i, tint)
    }
    chunks.instanceColor.needsUpdate = true
    chunks.visible = shock.visible = aura.visible = true
    shock.position.set(p.x, groundY + 0.06, p.z)
    aura.position.set(p.x, groundY + 0.45, p.z)
    burst({ x: p.x, y: groundY + 0.1, z: p.z }, 46, { speed: 7, up: 5, life: 0.9, color: [0.55, 0.4, 0.2], gravity: 10, spread: R * 0.6 })
    burst({ x: p.x, y: groundY + 0.1, z: p.z }, 24, { speed: 6, up: 6, life: 0.8, color: [0.5, 0.95, 0.3], gravity: 10, spread: R * 0.6 })
  }

  function clearCrater() {
    if (crater.on && crater.out < 0) crater.out = 0
  }

  function updateCrater(dt) {
    if (!crater.on) return
    crater.age += dt
    let sink = 0 // 0 = open, 1 = refilled
    if (crater.out >= 0) {
      crater.out += dt
      sink = Math.min(1, crater.out / 0.45)
    }
    for (let i = 0; i < crater.pieces.length; i++) {
      const c = crater.pieces[i]
      const t = Math.min(1, Math.max(0, (crater.age - c.delay) / 0.3))
      const k = 1 - Math.pow(1 - t, 3)
      const hop = Math.sin(t * Math.PI) * C.chunkSize[1] * 4 // thrown up, then settles
      tmp.position.set(crater.x + c.dx * k * (1 - sink), crater.y + c.dy * k + hop, crater.z + c.dz * k * (1 - sink))
      tmp.rotation.set(c.rx * k, c.ry, c.rz * k)
      tmp.scale.set(c.sx, c.sy, c.sz).multiplyScalar(Math.max(0.001, 1 - sink * sink) * Math.max(0.01, k))
      tmp.updateMatrix()
      chunks.setMatrixAt(i, tmp.matrix)
    }
    chunks.instanceMatrix.needsUpdate = true
    const sw = Math.min(1, crater.age / 0.5)
    shock.visible = sw < 1
    shock.scale.setScalar(0.5 + sw * (crater.R + C.debrisSpread) * 2.2)
    shock.material.opacity = 0.8 * (1 - sw)
    aura.scale.setScalar(crater.R * 2.2 * (1 + Math.sin(crater.age * 6) * 0.1) * (1 - sink))
    aura.material.opacity = 0.75 * (1 - sink)
    if (sink >= 1) {
      crater.on = false
      chunks.visible = shock.visible = aura.visible = false
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

  // Bonus Win ring labels ("+50%"), one painted sprite per tier, cloned per ring like the BOUNCE! one.
  const bonusProtos = K.bonusRing.tiers.map((t) => makeLabel([{ text: `+${t.pct}%`, px: 64, fill: t.fill, stroke: t.stroke }], { scale: 0.03 }))

  // Thick mint ring like the reference, with the Wins trophy above the % in its middle.
  const bonusCoreGeo = new TorusGeometry(R, 0.45, 14, 56)
  const bonusGlowGeo = new TorusGeometry(R, 0.75, 10, 56)
  const trophyTex = (() => {
    const c = makeCanvas(128, 128)
    const tex = new CanvasTexture(c)
    tex.colorSpace = SRGBColorSpace
    const img = new Image()
    img.onload = () => {
      c.getContext('2d').drawImage(img, 0, 0, 128, 128)
      tex.needsUpdate = true
    }
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(TROPHY_SVG)}`
    return tex
  })()

  // tier: a K.bonusRing.tiers entry for a Bonus Win ring (its colours and label), none for a BOUNCE! ring.
  function makeRing(x, y, z, tier = null) {
    const group = new Group()
    const proto = tier ? bonusProtos[K.bonusRing.tiers.indexOf(tier)] : labelProto
    const core = new Mesh(tier ? bonusCoreGeo : coreGeo, new MeshBasicMaterial({ color: tier?.color ?? '#3de8ff', transparent: true, toneMapped: false }))
    const glow = new Mesh(tier ? bonusGlowGeo : glowGeo, new MeshBasicMaterial({ color: tier?.glow ?? '#2a9bff', transparent: true, opacity: 0.28, blending: AdditiveBlending, depthWrite: false, toneMapped: false }))
    const disc = new Mesh(discGeo, new MeshBasicMaterial({ color: tier?.color ?? '#35d8ff', transparent: true, opacity: 0.2, side: DoubleSide, depthWrite: false, toneMapped: false }))
    if (tier) disc.material.opacity = 0.08
    const label = new Sprite(proto.material.clone())
    label.center.copy(proto.center)
    label.scale.copy(proto.scale)
    label.position.set(0, -0.05, 0.1)
    const arrow = new Sprite(new SpriteMaterial({ map: arrowTex, transparent: true, depthWrite: false }))
    arrow.scale.set(0.9, 0.9, 1)
    arrow.position.set(0, -0.7, 0.1)
    if (tier) {
      label.center.set(0.5, 0.5)
      label.position.set(0, -0.55, 0.1)
      arrow.material.map = trophyTex // the trophy takes the arrow's slot
      arrow.scale.set(1.5, 1.5, 1)
      arrow.position.set(0, 0.85, 0.1)
    }
    group.add(disc, glow, core, label, arrow)
    group.position.set(x, y, z)
    group.scale.setScalar(0.01)
    scene.add(group)
    const ring = { group, core, glow, disc, arrow, x, y, z, tier, age: 0, state: 'in', fade: 1 }
    rings.push(ring)
    return ring
  }

  function disposeRing(ring) {
    scene.remove(ring.group)
    ring.group.traverse((o) => o.material?.dispose()) // geometries and textures are shared
  }

  const spawnRing = (x, y, z) => makeRing(x, y, z)
  const spawnBonusRing = (x, y, z, tier) => makeRing(x, y, z, tier)

  // The ball flew through a Bonus Win ring: a big burst in the tier's colour.
  function hitBonus(ring) {
    hitRing(ring)
    const p = { x: ring.x, y: ring.y, z: ring.z }
    burst(p, 70, { speed: 12, up: 2, life: 0.9, color: ring.tier.rgb, gravity: 3, spread: R * 0.6 })
    burst(p, 24, { speed: 7, up: 4, life: 1, color: [1, 1, 1], gravity: 5 })
  }

  // The ball went past it: the ring fades out now instead of hanging behind.
  function fadeRing(ring) {
    if (ring.state === 'in' || ring.state === 'idle') {
      ring.state = 'out'
      ring.age = 0
    }
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
      r.disc.material.opacity = (r.tier ? 0.08 : 0.2) * a
      r.arrow.material.opacity = a
      if (!r.tier) r.arrow.position.y = -0.7 + Math.sin(r.age * 8) * 0.08
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
    updateCrater(dt)
    // The wake fades out soon after the ball stops refreshing it (landing).
    wakeAge += dt
    if (wake.visible) {
      const a = 1 - Math.min(1, Math.max(0, wakeAge - 0.05) / 0.2)
      wakeMat.opacity = 0.8 * a
      if (a <= 0) wake.visible = false
    }
  }

  return {
    update,
    // Streams a cone behind the ball along its velocity `v`.
    wake(p, v, boosted) {
      const sp = Math.hypot(v.x, v.y, v.z)
      if (sp < 0.5) return
      wakeDir.set(v.x / sp, v.y / sp, v.z / sp)
      wake.position.copy(p)
      wake.quaternion.setFromUnitVectors(UP, wakeDir)
      wake.scale.set(1, K.radius * 4, 1)
      wakeMat.color.set(boosted ? '#c8f6ff' : '#e4ffec')
      wakeMat.opacity = 0.8
      wake.visible = true
      wakeAge = 0
    },
    spawnRing,
    spawnBonusRing,
    hitBonus,
    fadeRing,
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
      spawnCrater(p, groundY)
    },
    clearCrater,
  }
}
