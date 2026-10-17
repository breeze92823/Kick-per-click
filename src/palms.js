// Detailed voxel plants and props shared by the arena and Beach World: coconut palms, shrubs, dune grass, umbrellas,
// surfboards and tiki torches. Built from yaw-only boxes plus `beam` boxes (voxels.js) that run between two points, so
// trunks lean and curve and leaves arch and droop. Everything is merged into one mesh per material, so detail costs
// vertices, not draw calls; the `lite` palm (lane flanks, cliff tops, seen from far away) is about half the boxes.
import { addCollider } from './colliders.js'
import { BEACH } from './config.js'
import { shade } from './textures.js'

const TAU = Math.PI * 2
const cache = new Map()

// Full palm palette from a tree theme ({ leaf, leafDark, trunk } hex colours, as in LANE_THEMES) or the beach colours.
function palmColors(pal) {
  if (pal.palmDark) return pal // already complete (BEACH.colors)
  const key = `${pal.leaf}|${pal.leafDark}|${pal.trunk}`
  if (!cache.has(key)) {
    cache.set(key, {
      palm: pal.leaf,
      palmDark: pal.leafDark,
      palmLight: shade(pal.leaf, 0.25),
      trunk: pal.trunk,
      trunkLight: shade(pal.trunk, 0.18),
      trunkDark: shade(pal.trunk, -0.32),
      coconut: '#6b4a2a',
      coconutGreen: '#7a9a2e',
    })
  }
  return cache.get(key)
}

// --- Coconut palm -------------------------------------------------------------------------------------------------------
// A curved, tapering trunk of tilted segments (banded two tones, ring scars, buttress roots), a crown boss with a
// coconut cluster, and arching fronds: each is a rachis of tilted beams with a pair of tapering leaflet blades per
// segment, drooping toward the tip. A few young fronds stand upright in the middle of the crown.
export function palm(b, mat, rand, x, y0, z, s = 1, { solid = true, lite = false, leanDir = rand() * TAU, pal = BEACH.colors } = {}) {
  const C = palmColors(pal)
  const H = (lite ? 7.2 : 8.4) * s
  const lean = (0.8 + rand() * 1.6) * s
  const lx = Math.cos(leanDir) * lean
  const lz = Math.sin(leanDir) * lean
  const at = (t) => [x + lx * t * t, y0 + H * (t - 0.04 * t * t), z + lz * t * t] // gentle curve: leans more toward the top
  const segs = lite ? 4 : 7
  const wAt = (t) => (0.95 - 0.42 * t) * s

  // Roots: four short buttresses splaying out of the base.
  const roots = lite ? 3 : 4
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * TAU + rand() * 0.6
    b.beam(mat, x + Math.cos(a) * 0.75 * s, y0, z + Math.sin(a) * 0.75 * s, x, y0 + 0.9 * s, z, 0.34 * s, 0.34 * s, C.trunkDark, -Math.sin(a), 0, Math.cos(a))
  }
  for (let k = 0; k < segs; k++) {
    const t0 = k / segs
    const t1 = (k + 1) / segs
    const p0 = at(t0)
    const p1 = at(t1)
    b.beam(mat, p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], wAt((t0 + t1) / 2), wAt((t0 + t1) / 2), k % 2 ? C.trunk : C.trunkLight)
    if (!lite && k > 0) b.box(mat, p0[0], p0[1], p0[2], wAt(t0) + 0.16 * s, 0.09 * s, wAt(t0) + 0.16 * s, C.trunkDark, rand()) // ring scar
  }
  const T = at(1)

  // Crown: a boss of dead frond bases, a coconut cluster, and hanging dead fronds.
  b.box(mat, T[0], T[1] - 0.05 * s, T[2], 1.05 * s, 0.7 * s, 1.05 * s, C.palmDark)
  b.box(mat, T[0], T[1] + 0.3 * s, T[2], 0.8 * s, 0.35 * s, 0.8 * s, C.trunkDark, 0.8)
  const nuts = lite ? 3 : 6
  for (let i = 0; i < nuts; i++) {
    const a = (i / nuts) * TAU + rand()
    const r = 0.5 * s
    b.box(mat, T[0] + Math.cos(a) * r, T[1] - 0.55 * s - (i % 2) * 0.12 * s, T[2] + Math.sin(a) * r, 0.44 * s, 0.46 * s, 0.44 * s, i % 3 ? C.coconut : C.coconutGreen, a)
  }

  // Fronds.
  const nf = lite ? 6 : 10
  const ns = lite ? 3 : 4
  const a0 = rand() * TAU
  const leafCols = [C.palm, C.palmDark, C.palmLight]
  for (let i = 0; i < nf; i++) {
    const young = !lite && i % 5 === 4
    const a = a0 + (i / nf) * TAU + (rand() - 0.5) * 0.35
    const dx = Math.cos(a)
    const dz = Math.sin(a)
    const reach = (young ? 1.7 : 3.1 + rand() * 0.9) * s
    const rise = (young ? 3.4 : 1.5 + rand() * 0.8) * s
    const droop = (young ? 1.6 : 3.2 + rand() * 1.4) * s
    const pts = []
    for (let j = 0; j <= ns; j++) {
      const t = j / ns
      pts.push([T[0] + dx * (0.35 * s + reach * t), T[1] + 0.15 * s + rise * t - droop * t * t, T[2] + dz * (0.35 * s + reach * t)])
    }
    const tilt = 0.5 + rand() * 0.25 // how far each leaflet blade droops below the rachis
    for (let j = 0; j < ns; j++) {
      const p0 = pts[j]
      const p1 = pts[j + 1]
      b.beam(mat, p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], 0.13 * s, 0.1 * s, C.palmDark)
      const t = (j + 0.5) / ns
      const bw = (lite ? 1.0 : 1.2) * (1 - 0.5 * t) * (j === ns - 1 ? 0.7 : 1) * s
      for (const side of [-1, 1]) {
        // Blade direction across the frond: sideways, then dipped by `tilt`.
        const ax = -dz * side * Math.cos(tilt)
        const az = dx * side * Math.cos(tilt)
        const ay = -Math.sin(tilt)
        const tip = j === ns - 1 ? 0.8 : 1 // the last blades stop short, so the frond ends in a point
        b.beam(
          mat,
          p0[0] + ax * bw * 0.5, p0[1] + ay * bw * 0.5, p0[2] + az * bw * 0.5,
          p0[0] + (p1[0] - p0[0]) * tip + ax * bw * 0.5, p0[1] + (p1[1] - p0[1]) * tip + ay * bw * 0.5, p0[2] + (p1[2] - p0[2]) * tip + az * bw * 0.5,
          bw, 0.07 * s, leafCols[(i + j + (side > 0 ? 1 : 0)) % 3], ax, ay, az,
        )
      }
    }
  }
  if (solid) addCollider(x, z, 0.85 * s, 0.85 * s, y0 + H)
}

// --- Shrub and grass ----------------------------------------------------------------------------------------------------
const GREENS = ['#2f9a4a', '#237a3a', '#4fbf5e']

// Tropical shrub: a fan of arching leaves in three greens, with a few flowers among them.
export function shrub(b, mat, rand, x, z, s = 1, y0 = 0.06, solid = true) {
  const greens = [BEACH.colors.bush ?? GREENS[0], BEACH.colors.bushDark ?? GREENS[1], BEACH.colors.bushLight ?? GREENS[2]]
  const n = 11
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rand() * 0.5
    const out = (0.7 + rand() * 0.7) * s
    const up = (0.7 + rand() * 0.8) * s
    const dx = Math.cos(a)
    const dz = Math.sin(a)
    const bx = x + dx * 0.15 * s
    const bz = z + dz * 0.15 * s
    const mx = bx + dx * out * 0.45
    const mz = bz + dz * out * 0.45
    const col = greens[i % 3]
    b.beam(mat, bx, y0, bz, mx, y0 + up * 0.8, mz, 0.55 * s, 0.06 * s, col, -dz, 0.4, dx) // rising half of the leaf
    b.beam(mat, mx, y0 + up * 0.8, mz, bx + dx * out, y0 + up * 0.75, bz + dz * out, 0.42 * s, 0.06 * s, col, -dz, 0.4, dx) // arching tip
  }
  for (let i = 0; i < 3; i++) {
    b.box(mat, x + (rand() - 0.5) * 1.3 * s, y0 + (1.0 + rand() * 0.5) * s, z + (rand() - 0.5) * 1.3 * s, 0.28 * s, 0.28 * s, 0.28 * s, BEACH.colors.flowers[Math.floor(rand() * BEACH.colors.flowers.length)], rand())
  }
  if (solid) addCollider(x, z, 1.4 * s, 1.4 * s, y0 + 1.1 * s)
}

// Dune grass: a fan of thin blades, each in two arching pieces, in pale greens.
export function duneGrass(b, mat, rand, x, z, y0 = 0.06) {
  const n = 7
  const cols = BEACH.colors.grass
  for (let i = 0; i < n; i++) {
    const a = rand() * TAU
    const dx = Math.cos(a)
    const dz = Math.sin(a)
    const h = 0.55 + rand() * 0.8
    const bx = x + (rand() - 0.5) * 0.5
    const bz = z + (rand() - 0.5) * 0.5
    const mx = bx + dx * 0.12
    const mz = bz + dz * 0.12
    const col = cols[i % 3]
    b.beam(mat, bx, y0, bz, mx, y0 + h * 0.55, mz, 0.1, 0.035, col, -dz, 0, dx)
    b.beam(mat, mx, y0 + h * 0.55, mz, mx + dx * 0.3, y0 + h, mz + dz * 0.3, 0.08, 0.03, col, -dz, 0, dx)
  }
}

// --- Beach props ------------------------------------------------------------------------------------------------------
// Beach umbrella: eight pitched canopy panels in alternating colours around a slightly tilted pole, a finial on top.
export function umbrella(b, mat, x, z, color) {
  const tx = x + 0.3
  const ty = 3.05
  b.box(mat, x, 0.06, z, 0.6, 0.12, 0.6, BEACH.colors.sandDark)
  b.beam(mat, x, 0, z, tx, ty, z, 0.15, 0.15, '#f2f2f5')
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.2
    const dx = Math.cos(a)
    const dz = Math.sin(a)
    b.beam(mat, tx, ty, z, tx + dx * 2.1, ty - 0.75, z + dz * 2.1, 1.7, 0.07, k % 2 ? '#ffffff' : color, -dz, 0, dx)
    b.beam(mat, tx + dx * 1.95, ty - 0.68, z + dz * 1.95, tx + dx * 2.15, ty - 0.95, z + dz * 2.15, 1.5, 0.06, k % 2 ? '#ffffff' : color, -dz, 0, dx) // scalloped edge
  }
  b.box(mat, tx, ty + 0.12, z, 0.22, 0.22, 0.22, '#ffd21f')
  addCollider(x, z, 0.3, 0.3, 2.9)
}

// Surfboard planted in the sand, leaning a little: a body that tapers to a pointed nose, a stripe, a fin, a mound of sand.
export function surfboard(b, mat, x, z, color, rot = 0) {
  const lx = Math.sin(rot) * 0.4
  const lz = Math.cos(rot) * 0.4
  const ax = Math.cos(rot)
  const az = -Math.sin(rot)
  const at = (f) => [x + lx * f, 0.1 + 3.0 * f, z + lz * f]
  const segs = [[0, 0.55, 0.62], [0.55, 0.85, 0.55], [0.85, 0.96, 0.36], [0.96, 1.0, 0.16]]
  for (const [f0, f1, w] of segs) {
    const p = at(f0)
    const q = at(f1)
    b.beam(mat, p[0], p[1], p[2], q[0], q[1], q[2], w, 0.13, color, ax, 0, az)
    b.beam(mat, p[0], p[1], p[2], q[0], q[1], q[2], w * 0.22, 0.15, '#ffffff', ax, 0, az) // centre stripe
  }
  const f = at(0.05)
  b.beam(mat, f[0], f[1] + 0.05, f[2] - 0.1, f[0], f[1] + 0.5, f[2] - 0.35, 0.06, 0.28, '#2a2a33', ax, 0, az) // fin
  b.box(mat, x, 0.12, z, 1.1, 0.24, 0.8, BEACH.colors.sandDark, rot)
  addCollider(x, z, 0.7, 0.7, 3)
}

// Tiki torch: bamboo with dark nodes and a rope binding, a flared cup, and a three-tongue flame.
export function tikiTorch(b, mat, x, z) {
  b.box(mat, x, 0.1, z, 0.6, 0.2, 0.6, BEACH.colors.sandDark)
  for (let k = 0; k < 3; k++) {
    b.beam(mat, x, 0.1 + k * 0.78, z, x, 0.1 + (k + 1) * 0.78, z, 0.24, 0.24, k % 2 ? '#a8803e' : '#c29a52')
    b.box(mat, x, 0.1 + (k + 1) * 0.78, z, 0.32, 0.08, 0.32, '#6a4a22', k)
  }
  b.box(mat, x, 1.55, z, 0.3, 0.16, 0.3, '#e8dcc0') // rope
  b.beam(mat, x, 2.4, z, x, 2.72, z, 0.4, 0.4, '#5a3a20') // cup
  b.beam(mat, x, 2.7, z, x, 2.92, z, 0.64, 0.64, '#4a2e18')
  b.box(mat, x, 2.93, z, 0.5, 0.05, 0.5, '#1e1208')
  b.beam(mat, x, 2.95, z, x, 3.35, z, 0.42, 0.42, '#ff6a1a')
  b.beam(mat, x - 0.04, 3.3, z, x - 0.1, 3.7, z + 0.05, 0.28, 0.28, '#ff9a1a')
  b.beam(mat, x + 0.06, 3.3, z, x + 0.1, 3.8, z - 0.05, 0.22, 0.22, '#ffd21f')
  b.beam(mat, x, 3.6, z, x, 4.0, z, 0.12, 0.12, '#fff2a0')
  addCollider(x, z, 0.3, 0.3, 2.4)
}
