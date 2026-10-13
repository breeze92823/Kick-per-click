// The arena's landmarks: training goals, spin wheel, update board, group-reward
// chest, leaderboards, NPC statues, the football upgrade hill and the Beach World
// portal. Static blocks go to the voxel builder; anything round, glowing or
// animated is its own mesh. update() handles walk-up interactions (E) and returns
// the HUD prompt for whatever the player stands at.
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
} from 'three'
import { addCollider } from './colliders.js'
import { BALL_ROWS, BALLS, COLORS, ECONOMY, PAD_BALL, SITES, TRAINING_FIELDS } from './config.js'
import { faceOrigin } from './arena.js'
import { makeLabel, paintText, whenFontsReady } from './labels.js'
import { ballMaterial, netMaterial, solid, studMaterial } from './materials.js'
import { glowTexture, makeCanvas, shade, wheelTexture } from './textures.js'
import { parkOnPad, player } from './player.js'
import { inputState } from './input.js'
import { authState } from './bloxity.js'
import { net, onLeaderboard } from './net.js'
import { ballKick, fieldUnlocked, formatNumber, freeSpinLeft, onStats, setField, stats, tickFreeSpin, useBall } from './stats.js'

const sphere = new SphereGeometry(1, 28, 18)
const unitBox = new BoxGeometry(1, 1, 1)

// A landmark's local frame: +Z faces `rotY` (default: toward the spawn).
function makeSite(root, b, x, z, rotY = faceOrigin(x, z)) {
  const c = Math.cos(rotY)
  const s = Math.sin(rotY)
  const toWorld = (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz]
  const toLocal = (wx, wz) => [c * (wx - x) - s * (wz - z), s * (wx - x) + c * (wz - z)]
  const group = new Group()
  group.position.set(x, 0, z)
  group.rotation.y = rotY
  root.add(group)
  const box = (mat, lx, ly, lz, w, h, d, color) => {
    const [wx, wz] = toWorld(lx, lz)
    b.box(mat, wx, ly, wz, w, h, d, color, rotY)
  }
  const collider = (lx, lz, w, d, top, bottom = 0) => {
    const [wx, wz] = toWorld(lx, lz)
    addCollider(wx, wz, w, d, top, rotY, bottom)
  }
  const add = (obj, lx, ly, lz) => {
    obj.position.set(lx, ly, lz)
    group.add(obj)
    return obj
  }
  return {
    group,
    toWorld,
    toLocal,
    box,
    collider,
    add,
    // A box that is also solid.
    solidBox(mat, lx, ly, lz, w, h, d, color) {
      box(mat, lx, ly, lz, w, h, d, color)
      collider(lx, lz, w, d, ly + h / 2, ly - h / 2)
    },
    label: (lines, lx, ly, lz, opts) => add(makeLabel(lines, opts), lx, ly, lz),
  }
}

function ball(base, patch, r) {
  const m = new Mesh(sphere, ballMaterial(base, patch))
  m.scale.setScalar(r)
  m.castShadow = true
  return m
}

function part(geo, color, { scale, rot } = {}) {
  const m = new Mesh(geo, typeof color === 'string' ? solid(color) : color)
  if (scale) m.scale.set(...scale)
  if (rot) m.rotation.set(...rot)
  m.castShadow = true
  return m
}

function cyl(rTop, rBottom, h, color, seg = 32) {
  return part(new CylinderGeometry(rTop, rBottom, h, seg), color)
}

// Dark round plinth the NPC statues stand on (top at 0.8).
function pedestal(site) {
  site.add(cyl(2.2, 2.35, 0.7, '#454552'), 0, 0.35, 0)
  site.add(cyl(2.0, 2.0, 0.14, '#5d5d6c'), 0, 0.75, 0)
  site.collider(0, 0, 3.6, 3.6, 0.8)
}

// --- Training goals ----------------------------------------------------------------------
function buildTraining(root, b, mat) {
  const site = makeSite(root, b, SITES.training.x, SITES.training.z, Math.PI / 2)
  const net = netMaterial()
  const pitch = 7
  const half = { w: 3.3, d: 4.7 }
  const fields = TRAINING_FIELDS.map((f, i) => {
    const fx = (i - (TRAINING_FIELDS.length - 1) / 2) * pitch
    site.solidBox(mat, fx, 0.125, 0, half.w * 2, 0.25, half.d * 2, f.color)
    site.box(mat, fx, 0.15, 0.3, 5.4, 0.3, 7.8, shade(f.color, 0.72))
    const gz = -3.4
    const gw = 5
    const gh = 2.6
    const gd = 1.8
    const y0 = 0.3
    site.solidBox(mat, fx - gw / 2, y0 + gh / 2, gz, 0.22, gh, 0.22, '#ffffff')
    site.solidBox(mat, fx + gw / 2, y0 + gh / 2, gz, 0.22, gh, 0.22, '#ffffff')
    site.box(mat, fx, y0 + gh, gz, gw + 0.22, 0.22, 0.22, '#ffffff')
    site.solidBox(net, fx, y0 + gh / 2, gz - gd, gw, gh, 0.04, f.color)
    site.box(net, fx, y0 + gh, gz - gd / 2, gw, 0.04, gd, f.color)
    site.box(net, fx - gw / 2, y0 + gh / 2, gz - gd / 2, 0.04, gh, gd, f.color)
    site.box(net, fx + gw / 2, y0 + gh / 2, gz - gd / 2, 0.04, gh, gd, f.color)
    const fieldBall = site.add(ball('#f4f4f4', '#1d1d22', 0.4), fx, y0 + 0.4, 1.6)
    const lines = []
    if (f.pass) lines.push({ text: f.pass, px: 40, fill: f.pass === 'VIP' ? 'gold' : 'green' })
    lines.push({ text: f.rebirths ? String(f.rebirths) : 'FREE', px: 30, badge: true, icon: 'rebirth' })
    lines.push({ text: f.name, px: 40, fill: 'gold' })
    site.label(lines, fx, y0 + gh + 0.5, gz, { scale: 0.022 })
    return { field: f, fx, ball: fieldBall, phase: 'ready', t: 0, baseScale: fieldBall.scale.x }
  })
  site.label([{ text: 'TRAIN HERE!', px: 110, fill: 'gold' }], 0, 6.2, -7, { scale: 0.03 })

  // The training spot (behind the ball, facing the goal) of the field under the player.
  const standZ = 2.5
  const entryOf = (entry) => {
    const [x, z] = site.toWorld(entry.fx, standZ)
    return { field: entry.field, x, z }
  }
  const restY = 0.3 + 0.4
  const { restZ, goalZ, arcHeight, flightTime, respawnDelay, popTime } = PAD_BALL
  for (const e of fields) e.ball.position.z = restZ
  return {
    // True when the pad ball sits at the player's feet, ready to be kicked.
    ready: (field) => {
      const e = fields.find((f) => f.field === field)
      return !!e && e.phase === 'ready'
    },
    // The field under the player ({ field, x, z }), or null.
    under() {
      if (player.position.y > 1.2) return null
      const [lx, lz] = site.toLocal(player.position.x, player.position.z)
      if (Math.abs(lz) > half.d) return null
      for (const entry of fields) if (Math.abs(lx - entry.fx) <= half.w) return entryOf(entry)
      return null
    },
    setBall(def) {
      const m = ballMaterial(def.color, def.patch)
      for (const e of fields) e.ball.material = m
    },
    // The foot meets the ball on the field the player is parked on: it flies into the goal,
    // vanishes there, then pops back in at the player's feet.
    shoot(field) {
      const entry = fields.find((e) => e.field === field)
      if (!entry || entry.phase !== 'ready') return
      entry.phase = 'fly'
      entry.t = 0
    },
    animate(dt) {
      for (const e of fields) {
        if (e.phase === 'ready') continue
        e.t += dt
        if (e.phase === 'fly') {
          const u = Math.min(e.t / flightTime, 1)
          e.ball.position.z = restZ + (goalZ - restZ) * u
          e.ball.position.y = restY + Math.sin(u * Math.PI) * arcHeight
          if (u >= 1) {
            e.phase = 'gone'
            e.t = 0
            e.ball.visible = false
          }
        } else if (e.phase === 'gone') {
          if (e.t >= respawnDelay) {
            e.phase = 'pop'
            e.t = 0
            e.ball.position.set(e.ball.position.x, restY, restZ)
            e.ball.scale.setScalar(0.001)
            e.ball.visible = true
          }
        } else if (e.phase === 'pop') {
          const u = Math.min(e.t / popTime, 1)
          e.ball.scale.setScalar(Math.max(u, 0.001) * e.baseScale)
          if (u >= 1) e.phase = 'ready'
        }
      }
    },
  }
}

// --- Spin the wheel ------------------------------------------------------------------------------
function buildWheel(root, b, mat) {
  const site = makeSite(root, b, SITES.wheel.x, SITES.wheel.z)
  const glow = new Mesh(new CircleGeometry(4.6, 40), new MeshBasicMaterial({ color: '#fff35a', transparent: true, opacity: 0.85 }))
  glow.rotation.x = -Math.PI / 2
  site.add(glow, 0, 0.16, 0)
  site.solidBox(mat, 0, 0.45, -0.2, 3.4, 0.6, 2.0, '#8a7fc0')
  site.solidBox(mat, 0, 2.4, -0.4, 0.9, 3.6, 0.7, '#7b6fae')
  const wheel = site.add(new Group(), 0, 4.8, 0.2)
  const face = new MeshStandardMaterial({ map: wheelTexture(), roughness: 0.5 })
  const disc = part(new CylinderGeometry(2.8, 2.8, 0.3, 48), [solid('#8c5ce0'), face, solid('#8c5ce0')], { rot: [Math.PI / 2, 0, 0] })
  wheel.add(disc)
  wheel.add(part(new TorusGeometry(2.85, 0.24, 10, 48), '#9b6bff'))
  const hub = part(new CylinderGeometry(0.45, 0.45, 0.5, 20), '#b48cff', { rot: [Math.PI / 2, 0, 0] })
  wheel.add(hub)
  const bulbs = []
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const bulb = new Mesh(sphere, new MeshBasicMaterial({ color: '#fff6c8' }))
    bulb.scale.setScalar(0.13)
    bulb.position.set(Math.cos(a) * 2.85, Math.sin(a) * 2.85, 0.22)
    wheel.add(bulb)
    bulbs.push(bulb)
  }
  const pointer = part(new ConeGeometry(0.4, 0.9, 4), '#ffd21a', { rot: [0, 0, Math.PI] })
  site.add(pointer, 0, 4.8 + 3.2, 0.45)
  const label = site.label(timerLines(ECONOMY.freeSpinSeconds), 0, 8.4, 0, { scale: 0.024 })

  let shown = -1
  return (t) => {
    tickFreeSpin()
    const left = freeSpinLeft()
    if (left !== shown) {
      shown = left
      label.setLines(timerLines(left))
    }
    bulbs.forEach((bulb, i) => bulb.material.color.set((i + Math.floor(t * 3)) % 2 ? '#fff6c8' : '#ffb84a'))
  }
}

function timerLines(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return [
    { text: 'SPIN THE WHEEL!', px: 54, fill: 'rainbow' },
    { text: seconds > 0 ? `Free spin in: ${mm}:${ss}` : 'Free spin ready!', px: 26 },
  ]
}

// --- "Next update" sign --------------------------------------------------------------------------
function buildSignBoard(root, b, mat) {
  const site = makeSite(root, b, SITES.signBoard.x, SITES.signBoard.z)
  const green = '#62c63a'
  const dark = '#3f9a26'
  site.solidBox(mat, -3, 1.5, 0, 0.8, 3, 0.8, dark)
  site.solidBox(mat, 3, 1.5, 0, 0.8, 3, 0.8, dark)
  site.solidBox(mat, 0, 5.4, 0, 9.6, 5.4, 0.8, green)
  for (const [lx, w, h] of [[-3.2, 3.2, 1.3], [0, 4.4, 2.1], [3.2, 3.2, 1.3]]) site.box(mat, lx, 8.1 + h / 2 - 0.1, 0, w, h, 0.8, green)
  const canvas = makeCanvas(860, 460)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  whenFontsReady(() => {
    const g = canvas.getContext('2d')
    const grad = g.createRadialGradient(430, 230, 20, 430, 230, 480)
    grad.addColorStop(0, '#2e7a36')
    grad.addColorStop(1, '#0c2a12')
    g.fillStyle = grad
    g.fillRect(0, 0, 860, 460)
    g.fillStyle = 'rgba(255,255,255,0.06)'
    for (let i = 0; i < 16; i += 2) {
      g.beginPath()
      g.moveTo(430, 230)
      g.arc(430, 230, 700, (i / 16) * Math.PI * 2, ((i + 1) / 16) * Math.PI * 2)
      g.fill()
    }
    paintText(g, 'SIGN UP', 430, 120, 74, '#e7f06a', '#16300f')
    paintText(g, 'NEXT UPDATE COMING', 430, 235, 70, '#e7f06a', '#16300f')
    paintText(g, 'SOON', 430, 350, 74, '#e7f06a', '#16300f')
    tex.needsUpdate = true
  })
  site.add(new Mesh(new PlaneGeometry(8.6, 4.6), new MeshBasicMaterial({ map: tex })), 0, 5.4, 0.41)
}

// --- Group reward chest -----------------------------------------------------------------------------
function buildChest(root, b, mat) {
  const site = makeSite(root, b, SITES.chest.x, SITES.chest.z)
  const Y = '#ffd21a'
  const R = '#e8302a'
  site.solidBox(mat, 0, 1.25, 0, 3.8, 2.2, 2.6, Y)
  for (const lx of [-0.95, 0.95]) {
    site.box(mat, lx, 1.25, 0, 1.4, 1.5, 2.66, R)
    site.box(mat, lx, 2.62, 0, 1.4, 0.62, 2.76, R)
    site.box(mat, lx, 3.06, 0, 1.4, 0.42, 2.26, R)
    site.box(mat, lx, 3.36, 0, 1.4, 0.32, 1.46, R)
  }
  site.box(mat, 0, 1.25, 0, 3.86, 1.5, 1.8, R)
  site.box(mat, 0, 2.6, 0, 3.9, 0.6, 2.7, Y)
  site.box(mat, 0, 3.05, 0, 3.9, 0.4, 2.2, Y)
  site.box(mat, 0, 3.35, 0, 3.9, 0.3, 1.4, Y)
  site.box(mat, 0, 2.3, 1.4, 0.6, 0.8, 0.16, '#3a2a1a')
  site.label([{ text: 'GROUP REWARD', px: 44, fill: 'gold' }], 0, 4.2, 0, { scale: 0.024 })
}

// --- Leaderboards ------------------------------------------------------------------------------------
const BOARDS = [
  { key: 'rebirths', title: 'TOP REBIRTHS', head: '#3a6cff', row: '#ffd6ec', alt: '#ffbfe0', own: () => stats.rebirths, format: formatNumber },
  { key: 'level', title: 'TOP LEVELS', head: '#ff9a1a', row: '#fff3a8', alt: '#ffe46a', own: () => stats.level, format: formatNumber },
  { key: 'playtime', title: 'TOP PLAYTIME', head: '#17a8a0', row: '#c8fff0', alt: '#9af0e0', own: () => stats.playtime, format: playtimeText },
]

function playtimeText(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m`
}

function buildLeaderboards(root, b, mat) {
  const site = makeSite(root, b, SITES.leaderboards.x, SITES.leaderboards.z, 0)
  const painters = BOARDS.map((board, i) => {
    const lx = (i - 1) * 7
    site.solidBox(mat, lx, 0.3, 0, 6, 0.6, 1.8, COLORS.stoneDark)
    site.solidBox(mat, lx - 2.45, 3.6, 0, 1, 6, 1, COLORS.stone)
    site.solidBox(mat, lx + 2.45, 3.6, 0, 1, 6, 1, COLORS.stone)
    site.solidBox(mat, lx, 3.85, -0.2, 3.9, 5.7, 0.2, COLORS.stoneDark)
    site.box(mat, lx, 6.9, 0, 6.2, 0.6, 1.4, COLORS.stoneDark)
    site.box(mat, lx, 7.45, 0, 5.2, 0.5, 1.2, COLORS.stone)
    site.box(mat, lx, 7.9, 0, 3.6, 0.4, 1.0, COLORS.stone)
    const canvas = makeCanvas(380, 560)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    site.add(new Mesh(new PlaneGeometry(3.8, 5.6), new MeshBasicMaterial({ map: tex })), lx, 3.85, -0.08)
    const paint = () => {
      const g = canvas.getContext('2d')
      g.fillStyle = '#20202c'
      g.fillRect(0, 0, 380, 560)
      g.fillStyle = board.head
      g.fillRect(6, 6, 368, 60)
      paintText(g, board.title, 190, 37, 34, 'white')
      const name = authState.user?.username || authState.user?.displayName || 'You'
      for (let r = 0; r < 10; r++) {
        const y = 72 + r * 48
        g.fillStyle = r % 2 ? board.alt : board.row
        g.fillRect(6, y, 368, 44)
        const row = net.leaderboard[board.key]?.[r]
        paintText(g, `${r + 1}.`, 16, y + 23, 24, 'white', '#1b1b26', 'left')
        if (row) {
          paintText(g, String(row.name).slice(0, 14), 58, y + 23, 24, 'white', '#1b1b26', 'left')
          paintText(g, board.format(row.value), 362, y + 23, 24, 'gold', '#1b1b26', 'right')
        } else if (!net.connected && r === 0) {
          // Offline: the board shows just this player.
          paintText(g, name.slice(0, 14), 58, y + 23, 24, 'white', '#1b1b26', 'left')
          paintText(g, board.format(board.own()), 362, y + 23, 24, 'gold', '#1b1b26', 'right')
        } else paintText(g, '---', 58, y + 23, 24, 'white', '#1b1b26', 'left')
      }
      tex.needsUpdate = true
    }
    whenFontsReady(paint)
    return paint
  })
  return () => painters.forEach((p) => p())
}

// --- NPC statues ------------------------------------------------------------------------------------------
function faceTexture() {
  const c = makeCanvas(128, 128)
  const g = c.getContext('2d')
  g.fillStyle = '#ffd21a'
  g.fillRect(0, 0, 128, 128)
  g.fillStyle = '#1b1b1b'
  g.beginPath()
  g.ellipse(44, 52, 7, 12, 0, 0, Math.PI * 2)
  g.ellipse(84, 52, 7, 12, 0, 0, Math.PI * 2)
  g.fill()
  g.lineWidth = 7
  g.strokeStyle = '#1b1b1b'
  g.lineCap = 'round'
  g.beginPath()
  g.arc(64, 70, 26, 0.2 * Math.PI, 0.8 * Math.PI)
  g.stroke()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

// The classic blocky "noob" holding a football: "Buy better Footballs".
function buildNoob(root, b) {
  const site = makeSite(root, b, SITES.noob.x, SITES.noob.z)
  pedestal(site)
  const fig = site.add(new Group(), 0, 0.8, 0)
  fig.scale.setScalar(1.3)
  const box = (w, h, d, color, x, y, z) => {
    const m = part(unitBox, color, { scale: [w, h, d] })
    m.position.set(x, y, z)
    fig.add(m)
    return m
  }
  box(0.48, 1, 0.48, '#a3c84a', -0.25, 0.5, 0)
  box(0.48, 1, 0.48, '#a3c84a', 0.25, 0.5, 0)
  box(1, 1, 0.5, '#1f7ae0', 0, 1.5, 0)
  for (const side of [-1, 1]) {
    const shoulder = new Group()
    shoulder.position.set(side * 0.74, 1.95, 0)
    shoulder.rotation.x = -1.15
    const arm = part(unitBox, '#ffd21a', { scale: [0.48, 1, 0.48] })
    arm.position.y = -0.45
    shoulder.add(arm)
    fig.add(shoulder)
  }
  const yellow = solid('#ffd21a')
  const head = new Mesh(unitBox, [yellow, yellow, yellow, yellow, new MeshStandardMaterial({ map: faceTexture(), roughness: 0.8 }), yellow])
  head.scale.setScalar(0.66)
  head.position.set(0, 2.33, 0)
  head.castShadow = true
  fig.add(head)
  const held = ball('#f4f4f4', '#1d1d22', 0.42)
  held.position.set(0, 1.55, 0.78)
  fig.add(held)
  site.collider(0, 0, 1.6, 1.2, 4.2)
  site.label([{ text: 'Buy better Footballs to', px: 26 }, { text: 'earn more per click!', px: 26 }], 0, 4.4, 0, { scale: 0.022 })
}

// "Chillin Chilli": a limited pet on a plinth.
function buildChili(root, b) {
  const site = makeSite(root, b, SITES.chili.x, SITES.chili.z)
  pedestal(site)
  const fig = site.add(new Group(), 0, 0.8, 0)
  const red = '#e2261c'
  const body = part(new CapsuleGeometry(0.75, 1.5, 8, 18), red)
  body.position.y = 1.85
  body.rotation.z = 0.08
  fig.add(body)
  const calyx = part(new ConeGeometry(0.62, 0.4, 7), '#3cae2a', { rot: [Math.PI, 0, 0] })
  calyx.position.y = 3.3
  fig.add(calyx)
  const stem = part(new CylinderGeometry(0.1, 0.16, 0.7, 8), '#2f9a22', { rot: [0, 0, -0.5] })
  stem.position.set(0.15, 3.65, 0)
  fig.add(stem)
  const glasses = part(unitBox, '#141418', { scale: [1.3, 0.3, 0.14] })
  glasses.position.set(0, 2.55, 0.68)
  fig.add(glasses)
  const shine = part(unitBox, '#ff4a4a', { scale: [0.3, 0.1, 0.02] })
  shine.position.set(-0.3, 2.6, 0.76)
  fig.add(shine)
  const mouth = part(unitBox, '#5a0a0a', { scale: [0.45, 0.08, 0.06] })
  mouth.position.set(0, 2.1, 0.72)
  fig.add(mouth)
  for (const side of [-1, 1]) {
    const leg = part(new CylinderGeometry(0.11, 0.11, 0.8, 8), '#c41e16')
    leg.position.set(side * 0.3, 0.4, 0)
    fig.add(leg)
    const shoe = part(unitBox, '#ffffff', { scale: [0.32, 0.2, 0.5] })
    shoe.position.set(side * 0.3, 0.1, 0.08)
    fig.add(shoe)
    const arm = part(new CylinderGeometry(0.1, 0.1, 1.1, 8), '#c41e16', { rot: [0, 0, side * 0.9] })
    arm.position.set(side * 1.05, 2.0, 0)
    fig.add(arm)
  }
  site.collider(0, 0, 1.8, 1.8, 4.5)
  site.label(
    [
      { text: 'LIMITED', px: 30, fill: 'red' },
      { text: 'Chillin Chilli', px: 44, fill: 'white', stroke: '#6a0a0a' },
      { text: '100x Wins', px: 32, fill: 'green' },
      { text: '499', px: 30, fill: 'green', icon: 'gem' },
      { text: '751 / 1000 left', px: 28, fill: 'gold' },
    ],
    0,
    5,
    0,
    { scale: 0.022 },
  )
}

// --- Upgrade hill ---------------------------------------------------------------------------------------------
function ballLines(i) {
  // Status line like Stone-Skipping's stones: EQUIPPED / PRESS E TO EQUIP / PRESS E TO BUY / LOCKED.
  const top =
    stats.equipped === i
      ? { text: 'EQUIPPED', fill: 'gold' }
      : stats.owned.includes(i)
        ? { text: 'PRESS E TO EQUIP', fill: '#3cff55' }
        : stats.wins >= BALLS[i].cost
          ? { text: 'PRESS E TO BUY', fill: 'gold' }
          : { text: 'LOCKED', fill: '#ff2d2d' }
  if (BALLS[i].blackHole) {
    return [
      { text: 'BLACK HOLE BALL', px: 24, fill: 'purple' },
      { ...top, px: 20 },
      { text: `${formatNumber(BALLS[i].cost)} Wins`, px: 22, fill: 'white' },
      { text: `+${formatNumber(ballKick(i))} Kick (2X BEST BALL)`, px: 18, fill: 'gold' },
    ]
  }
  return [
    { ...top, px: 20 },
    { text: `${formatNumber(BALLS[i].cost)} Wins`, px: 22, fill: 'white' },
    { text: `+${BALLS[i].kick} Kick`, px: 24, fill: 'gold' },
  ]
}

function buildUpgrades(root, b, mat) {
  const site = makeSite(root, b, SITES.upgrades.x, SITES.upgrades.z, -Math.PI / 2) // front faces due west (-X)
  const W = 24
  const tierD = 4.6
  const step = 1.2
  const front = 7
  const tierZ = (k) => front - tierD * (k + 0.5)
  for (let k = 0; k < 3; k++) {
    const top = step * (k + 1)
    site.box(mat, 0, (top - 0.1) / 2, tierZ(k), W, top - 0.1, tierD, COLORS.wall)
    site.box(mat, 0, top - 0.05, tierZ(k), W, 0.1, tierD, COLORS.floor)
    site.collider(0, tierZ(k), W, tierD, top)
    // Stepped flanks either side.
    for (const side of [-1, 1]) site.solidBox(mat, side * (W / 2 + 2), (top + 1.6) / 2, tierZ(k), 4, top + 1.6, tierD, COLORS.wall)
  }
  const backZ = front - tierD * 3 - 4
  site.solidBox(mat, 0, 3, backZ, W + 8, 6, 8, COLORS.wall)
  site.box(mat, 0, 6, backZ, W + 8, 1.2, 8.4, COLORS.grass)
  site.label([{ text: 'UPGRADES!', px: 120, fill: 'purple' }], 0, 10.5, backZ, { scale: 0.03 })

  const rims = ['#7fe8ff', '#ff8ad0', '#8cff8a', '#ff9a6a', '#c7a0ff']
  const pads = []
  const spinners = []
  let index = 0
  BALL_ROWS.forEach((count, k) => {
    const slots = k === 0 ? count + 1 : count // the front row ends with the black hole ball
    const spacing = (W - 3) / slots
    const top = step * (k + 1)
    for (let j = 0; j < slots; j++) {
      const lx = (j - (slots - 1) / 2) * spacing
      const lz = tierZ(k) + 0.6
      const blackHole = k === 0 && j === slots - 1
      const [wx, wz] = site.toWorld(lx, lz)
      site.add(cyl(1.1, 1.15, 0.2, blackHole ? '#ff4a4a' : rims[index % rims.length], 24), lx, top + 0.1, lz)
      site.add(cyl(0.85, 0.85, 0.22, '#eaf6ff', 24), lx, top + 0.12, lz)
      const y = top + 1.0
      if (blackHole) {
        const core = new Mesh(sphere, new MeshStandardMaterial({ color: '#050508', roughness: 0.2 }))
        core.scale.setScalar(0.7)
        site.add(core, lx, y, lz)
        const ring = site.add(new Mesh(new TorusGeometry(1.0, 0.08, 8, 40), new MeshBasicMaterial({ color: '#ff7a1a' })), lx, y, lz)
        const halo = new Sprite(new SpriteMaterial({ map: glowTexture('rgba(255,110,30,0.9)'), blending: AdditiveBlending, depthWrite: false, transparent: true }))
        halo.scale.setScalar(3.2)
        site.add(halo, lx, y, lz)
        spinners.push({ mesh: ring, y, phase: 0, ring: true })
        const i = BALLS.length - 1
        const label = site.label(ballLines(i), lx, top + 2.0, lz, { scale: 0.022 })
        pads.push({ i, label, wx, wz, top })
      } else {
        const i = index++
        const m = site.add(ball(BALLS[i].color, BALLS[i].patch, 0.55), lx, y, lz)
        spinners.push({ mesh: m, y, phase: i * 0.7 })
        const label = site.label(ballLines(i), lx, top + 1.85, lz, { scale: 0.022 })
        pads.push({ i, label, wx, wz, top })
      }
    }
  })

  onStats((what) => {
    if (what === 'balls' || what === 'wins' || what === 'rebirth') for (const p of pads) p.label.setLines(ballLines(p.i))
  })

  return {
    animate(t) {
      for (const s of spinners) {
        if (s.ring) {
          s.mesh.rotation.x = t * 0.9
          s.mesh.rotation.y = t * 1.3
        } else {
          s.mesh.rotation.y = t * 1.2 + s.phase
          s.mesh.position.y = s.y + Math.sin(t * 2 + s.phase) * 0.12
        }
      }
    },
    // The pad the player stands at, or null.
    padAt(p) {
      for (const pad of pads) if (Math.hypot(p.x - pad.wx, p.z - pad.wz) < 1.6 && Math.abs(p.y - pad.top) < 1.5) return pad
      return null
    },
  }
}

// --- Beach World portal ------------------------------------------------------------------------------------------
function buildBeachPortal(root, b, mat) {
  const site = makeSite(root, b, SITES.beachPortal.x, SITES.beachPortal.z)
  site.add(cyl(4.2, 4.4, 0.35, '#ff6fd0', 40), 0, 0.175, 0)
  site.add(cyl(3.8, 3.8, 0.06, '#ffb0ea', 40), 0, 0.37, 0)
  site.collider(0, 0, 6.6, 6.6, 0.38)
  const R = 3.4
  const cols = ['#ff8ad8', '#ffffff', '#5fe0ff']
  let n = 0
  for (const side of [-1, 1]) {
    for (let y = 0.9; y < 3.6; y += 1) site.box(mat, side * R, y, 0, 1, 1, 1, cols[n++ % 3])
    site.collider(side * R, 0, 1, 1, 3.6 + R)
  }
  for (let k = 0; k <= 12; k++) {
    const a = (k / 12) * Math.PI
    site.box(mat, Math.cos(a) * R, 3.6 + Math.sin(a) * R, 0, 1, 1, 1, cols[n++ % 3])
  }
  // Portal surface: a rounded-top doorway with a pink glow.
  const r = R - 0.5
  const shape = new Shape()
  shape.moveTo(-r, 0.4)
  shape.lineTo(-r, 3.6)
  shape.absarc(0, 3.6, r, Math.PI, 0, true)
  shape.lineTo(r, 0.4)
  shape.closePath()
  const geo = new ShapeGeometry(shape, 24)
  const pos = geo.attributes.position
  const uv = geo.attributes.uv
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + r) / (2 * r), pos.getY(i) / (3.6 + r))
  const c = makeCanvas(128, 256)
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 150, 6, 64, 150, 150)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(0.35, '#ffb0f0')
  grad.addColorStop(1, '#ff3fbf')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 256)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  const surface = new Mesh(geo, new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, side: DoubleSide }))
  site.add(surface, 0, 0, 0)
  site.collider(0, 0, 2 * R, 0.4, 3.6 + R)
  site.label(
    [
      { text: 'BEACH WORLD', px: 80, fill: 'cyan' },
      { text: '2X WINS', px: 50, fill: 'gold' },
    ],
    0,
    8.3,
    0,
    { scale: 0.026 },
  )
  // Entry sign beside the arch.
  site.solidBox(mat, R + 2.2, 0.9, 0.6, 0.25, 1.8, 0.25, '#e8e8f0')
  site.label(
    [
      { text: '10 Rebirths', px: 22, icon: 'rebirth', badge: '#ffffff', fill: '#ff5ac8', stroke: '#5a0a3a' },
      { text: 'to enter!', px: 22 },
    ],
    R + 2.2,
    1.8,
    0.6,
    { scale: 0.02 },
  )
  return (t) => {
    surface.material.opacity = 0.82 + Math.sin(t * 2.5) * 0.08
  }
}

// --- Assembly --------------------------------------------------------------------------------------------------------
export function createLandmarks(scene, b, onResult = () => {}) {
  const root = new Group()
  scene.add(root)
  const mat = studMaterial()
  const training = buildTraining(root, b, mat)
  onStats((what) => {
    if (what === 'balls') training.setBall(BALLS[stats.equipped] ?? BALLS[0]) // pad balls show the equipped football
  })
  training.setBall(BALLS[stats.equipped] ?? BALLS[0])
  let padLeg = 'R' // the leg the next pad kick uses
  let parkedField = null // the unlocked field the player was last parked on (re-parks only after leaving it)
  const wheel = buildWheel(root, b, mat)
  buildSignBoard(root, b, mat)
  buildChest(root, b, mat)
  const repaintBoards = buildLeaderboards(root, b, mat)
  onLeaderboard(repaintBoards) // server rows arrive every few seconds
  buildNoob(root, b)
  buildChili(root, b)
  const upgrades = buildUpgrades(root, b, mat)
  const portal = buildBeachPortal(root, b, mat)

  onStats((what) => {
    if (what === 'level' || what === 'rebirth') repaintBoards()
  })
  let boardTimer = 0

  return {
    // Pad kicks alternate legs (right first); the leg resets to right whenever the player steps onto a pad.
    padLeg: () => padLeg,
    padBallReady: () => !!parkedField && training.ready(parkedField),
    shootTrainingBall: () => {
      if (!parkedField) return
      training.shoot(parkedField)
      padLeg = padLeg === 'R' ? 'L' : 'R'
    },
    // True while the player stands on the wheel's glowing pad (opens the Lucky Wheel window).
    atWheel: () => Math.hypot(player.position.x - SITES.wheel.x, player.position.z - SITES.wheel.z) < 4.4 && player.position.y < 2,
    // Returns the HUD prompt for where the player stands (or null).
    update(dt, t) {
      wheel(t)
      upgrades.animate(t)
      portal(t)
      boardTimer += dt
      if (boardTimer > 30) {
        boardTimer = 0
        repaintBoards() // playtime ticks over
      }

      const interact = inputState.interact
      inputState.interact = false

      training.animate(dt)
      const under = training.under()
      const field = under?.field ?? null
      setField(field && fieldUnlocked(field) ? field : null)
      const parkable = field && fieldUnlocked(field) ? field : null
      if (parkable !== parkedField) {
        parkedField = parkable
        padLeg = 'R'
        if (parkable) parkOnPad(under.x, under.z) // walks to the spot, faces the goal; kicks animate on click
      }
      if (field) return fieldUnlocked(field) ? `Training: ${field.name} - Auto Kick` : `Needs ${field.rebirths} Rebirths`

      const pad = upgrades.padAt(player.position)
      if (pad) {
        if (interact) {
          const r = useBall(pad.i)
          if (r === 'unlocked') onResult(`Ball Purchased! +${formatNumber(ballKick(pad.i))} Kick`, true)
          else if (r === 'equipped') onResult('Ball Equipped', true)
          else if (r === 'locked') onResult(`Need ${formatNumber(BALLS[pad.i].cost)} Wins to Buy`, false)
        }
        if (stats.equipped === pad.i) return 'Equipped'
        if (stats.owned.includes(pad.i)) return 'Press E to equip'
        if (stats.wins >= BALLS[pad.i].cost) return 'Press E to buy'
        return `Needs ${formatNumber(BALLS[pad.i].cost)} Wins`
      }
      return null
    },
  }
}

