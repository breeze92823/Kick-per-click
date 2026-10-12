// Canvas-painted textures, all procedural. Each painter is cached by its arguments.
import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace } from 'three'
import { COLORS } from './config.js'

const cache = new Map()
export function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

// Canvas -> texture. `srgb: false` for data maps (bump, roughness).
export function toTexture(c, { repeat = true, pixel = false, srgb = true, tiles = null } = {}) {
  const t = new CanvasTexture(c)
  if (srgb) t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping
  if (tiles) t.repeat.set(tiles, tiles)
  if (pixel) t.magFilter = NearestFilter
  return t
}

// Deterministic PRNG so painted textures look the same every load.
export function mulberry32(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Mix a hex colour toward white (amt > 0) or black (amt < 0).
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)),
  )
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`
}

const circle = (g, x, y, r) => {
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
}

// One raised stud: drop shadow, cap, top-left rim light. `light`/`dark` are fill styles.
function stud(g, x, y, r, cap, light, dark) {
  g.fillStyle = dark
  circle(g, x + r * 0.12, y + r * 0.2, r)
  g.fillStyle = cap
  circle(g, x, y, r)
  g.strokeStyle = light
  g.lineWidth = r * 0.22
  g.beginPath()
  g.arc(x, y, r * 0.78, Math.PI * 0.95, Math.PI * 1.65)
  g.stroke()
}

// Greyscale stud plate, 2x2 studs per metre. Voxel props tint it by vertex colour.
export function studTexture() {
  return cached('studs', () => {
    const S = 128
    const c = makeCanvas(S, S)
    const g = c.getContext('2d')
    g.fillStyle = '#ececec'
    g.fillRect(0, 0, S, S)
    g.fillStyle = 'rgba(0,0,0,0.09)'
    g.fillRect(0, S - 3, S, 3)
    g.fillRect(S - 3, 0, 3, S)
    g.fillStyle = 'rgba(255,255,255,0.5)'
    g.fillRect(0, 0, S, 2)
    g.fillRect(0, 0, 2, S)
    const cell = S / 2
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) stud(g, (i + 0.5) * cell, (j + 0.5) * cell, cell * 0.3, '#f7f7f7', 'rgba(255,255,255,0.95)', 'rgba(0,0,0,0.14)')
    }
    return toTexture(c)
  })
}

export const FLOOR_TILE_M = 4 // metres of ground covered by one floor tile

// The orange arena floor: 1x2 m plates in a basket weave, one stud per square metre.
export function paintFloor() {
  return cached('floor', () => {
    const S = 512
    const N = 8 // studs per tile side (0.5 m pitch)
    const cell = S / N
    const c = makeCanvas(S, S)
    const g = c.getContext('2d')
    const rand = mulberry32(7)
    g.fillStyle = COLORS.floor
    g.fillRect(0, 0, S, S)
    const rr = (x, y, w, h, r) => {
      g.beginPath()
      g.moveTo(x + r, y)
      g.arcTo(x + w, y, x + w, y + h, r)
      g.arcTo(x + w, y + h, x, y + h, r)
      g.arcTo(x, y + h, x, y, r)
      g.arcTo(x, y, x + w, y, r)
      g.closePath()
    }
    const size = cell * 0.5
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const x = i * cell + (cell - size) / 2
        const y = j * cell + (cell - size) / 2
        const roll = rand()
        // Studs alternate light/dark along the grid, with a few plain ones mixed in.
        const kind = roll < 0.18 ? 0 : (i + j) % 2 === 0 ? 1 : -1
        const fill = kind === 1 ? COLORS.floorLight : kind === -1 ? COLORS.floorDark : COLORS.floor
        g.fillStyle = 'rgba(150,60,10,0.18)'
        rr(x + 1, y + 3, size, size, size * 0.22)
        g.fill()
        g.fillStyle = fill
        rr(x, y, size, size, size * 0.22)
        g.fill()
        g.strokeStyle = kind === 1 ? COLORS.floor : COLORS.floorSeam
        g.lineWidth = 3
        g.stroke()
        g.fillStyle = 'rgba(255,240,220,0.35)'
        rr(x + 4, y + 4, size - 8, 4, 2)
        g.fill()
      }
    }
    return c
  })
}

// --- Football pattern ----------------------------------------------------------
// A truncated icosahedron: 12 pentagons (icosahedron vertices) and 20 hexagons
// (its face centres). A direction belongs to the nearest centre; near-ties are seams.
let ballCentres = null
function centres() {
  if (ballCentres) return ballCentres
  const phi = (1 + Math.sqrt(5)) / 2
  const v = []
  for (const a of [-1, 1]) for (const b of [-phi, phi]) v.push([0, a, b], [a, b, 0], [b, 0, a])
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2
  const edge = (p, q) => Math.abs(d2(p, q) - 4) < 0.01
  const faces = []
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      for (let k = j + 1; k < 12; k++)
        if (edge(v[i], v[j]) && edge(v[j], v[k]) && edge(v[i], v[k])) faces.push([0, 1, 2].map((n) => v[i][n] + v[j][n] + v[k][n]))
  const norm = (p) => {
    const l = Math.hypot(p[0], p[1], p[2])
    return [p[0] / l, p[1] / l, p[2] / l]
  }
  ballCentres = [...v.map(norm), ...faces.map(norm)]
  return ballCentres
}

// The panel under a unit direction: 0 = hexagon, 1 = pentagon, 2 = seam.
export function soccerPanel(x, y, z) {
  const cs = centres()
  let best = -2
  let second = -2
  let bi = 0
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]
    const d = c[0] * x + c[1] * y + c[2] * z
    if (d > best) {
      second = best
      best = d
      bi = i
    } else if (d > second) second = d
  }
  if (best - second < 0.022) return 2
  return bi < 12 ? 1 : 0
}

// Unit vector of one pentagon centre (the spawn pad is centred on it).
export const pentagonAxis = () => centres()[0]

// Equirectangular football map for a SphereGeometry.
export function ballTexture(base, patch) {
  return cached(`ball${base}${patch}`, () => {
    const W = 256
    const H = 128
    const c = makeCanvas(W, H)
    const g = c.getContext('2d')
    const img = g.createImageData(W, H)
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    const b = rgb(base)
    const cols = [b, rgb(patch), b.map((v) => Math.round(v * 0.62))]
    for (let py = 0; py < H; py++) {
      const th = ((py + 0.5) / H) * Math.PI
      for (let px = 0; px < W; px++) {
        const ph = ((px + 0.5) / W) * Math.PI * 2
        const col = cols[soccerPanel(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th))]
        const o = (py * W + px) * 4
        img.data[o] = col[0]
        img.data[o + 1] = col[1]
        img.data[o + 2] = col[2]
        img.data[o + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
    return toTexture(c, { repeat: false })
  })
}

// Goal net: white cords on transparent, 3 cells per metre (tinted by vertex colour).
export function netTexture() {
  return cached('net', () => {
    const S = 48
    const c = makeCanvas(S, S)
    const g = c.getContext('2d')
    g.fillStyle = '#ffffff'
    for (let i = 0; i < 3; i++) {
      g.fillRect(i * 16, 0, 3, S)
      g.fillRect(0, i * 16, S, 3)
    }
    return toTexture(c)
  })
}

// Prize wheel face: eight coloured wedges with white dividers.
export function wheelTexture() {
  return cached('wheel', () => {
    const S = 512
    const c = makeCanvas(S, S)
    const g = c.getContext('2d')
    const cols = ['#ff2a2a', '#ff7a1a', '#ffe01a', '#4ee02a', '#1ad0ff', '#2a5aff', '#a02aff', '#ff2ad0']
    const r = S / 2
    cols.forEach((col, i) => {
      const a0 = (i / cols.length) * Math.PI * 2 - Math.PI / 2
      const a1 = ((i + 1) / cols.length) * Math.PI * 2 - Math.PI / 2
      g.fillStyle = col
      g.beginPath()
      g.moveTo(r, r)
      g.arc(r, r, r, a0, a1)
      g.closePath()
      g.fill()
      g.strokeStyle = '#ffffff'
      g.lineWidth = 6
      g.stroke()
    })
    const sheen = g.createRadialGradient(r * 0.7, r * 0.6, 10, r, r, r)
    sheen.addColorStop(0, 'rgba(255,255,255,0.35)')
    sheen.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = sheen
    g.fillRect(0, 0, S, S)
    return toTexture(c, { repeat: false })
  })
}

// Soft round glow for additive halo sprites.
export function glowTexture(color) {
  return cached(`glow${color}`, () => {
    const S = 128
    const c = makeCanvas(S, S)
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    grad.addColorStop(0, color)
    grad.addColorStop(0.35, color)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, S, S)
    return toTexture(c, { repeat: false })
  })
}

// Two-tone checker with a soft top-left highlight, for blocky props and test blocks.
export function checkerTexture(colA, colB, cells = 2) {
  return cached(`checker${colA}${colB}${cells}`, () => {
    const S = 128
    const c = makeCanvas(S, S)
    const g = c.getContext('2d')
    const cell = S / cells
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        g.fillStyle = (i + j) % 2 ? colB : colA
        g.fillRect(i * cell, j * cell, cell, cell)
        g.fillStyle = 'rgba(255,255,255,0.18)'
        g.fillRect(i * cell, j * cell, cell, 3)
        g.fillStyle = 'rgba(0,0,0,0.12)'
        g.fillRect(i * cell, (j + 1) * cell - 3, cell, 3)
      }
    }
    return toTexture(c, { pixel: true })
  })
}
