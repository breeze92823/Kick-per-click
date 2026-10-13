// The static map: two rings of stud cliffs with grass caps and drips around the
// arena, the long kick lane to the south, curbed lawns, the football spawn pad
// and voxel trees. Everything goes into the voxel builder (one mesh per material).
import { addCollider } from './colliders.js'
import { ARENA, COLORS, LANE, LANE_THEMES, LAWNS, SITES, SPAWN_PAD_RADIUS, clamp } from './config.js'
import { studMaterial } from './materials.js'
import { mulberry32, pentagonAxis, soccerPanel } from './textures.js'

export const faceOrigin = (x, z) => Math.atan2(-x, -z)

export function buildArena(b) {
  const mat = studMaterial()
  const rand = mulberry32(2024)
  buildWalls(b, mat, rand)
  buildLane(b, mat, rand)
  for (const l of LAWNS) lawn(b, mat, rand, l.parts ?? [[l.x, l.z, l.w, l.d]], l.rot ?? 0)
  buildKickStrip(b, mat)
  buildSpawnPad(b, mat)
  scatterTrees(b, mat, rand)
}

// --- Cliffs ------------------------------------------------------------------------
// One straight, axis-aligned cliff from (x0, z0) to (x1, z1); (nx, nz) points into
// the play area. Columns step up and down; the outer ring stands taller.
function cliffRun(b, mat, rand, x0, z0, x1, z1, nx, nz, heights, drop = 0, pal = {}) {
  const { wall = COLORS.wall, cap = COLORS.grass, capDark = COLORS.grassDark, tree } = pal
  const alongX = z0 === z1
  const len = Math.abs(alongX ? x1 - x0 : z1 - z0)
  const n = Math.max(1, Math.round(len / ARENA.column))
  const colW = len / n
  const t = ARENA.wallThickness
  const ux = alongX ? Math.sign(x1 - x0) : 0
  const uz = alongX ? 0 : Math.sign(z1 - z0)
  const lip = 0.5
  let h = heights.min + Math.floor((rand() * (heights.max - heights.min)) / 2) * 2
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n
    const cx = x0 + (x1 - x0) * f
    const cz = z0 + (z1 - z0) * f
    h = clamp(h + [-2, 0, 0, 2][Math.floor(rand() * 4)], heights.min, heights.max)
    for (let ring = 0; ring < 2; ring++) {
      const hh = h + ring * (6 + Math.floor(rand() * 3) * 2)
      const bx = cx - nx * (t / 2 + ring * t)
      const bz = cz - nz * (t / 2 + ring * t)
      const w = alongX ? colW : t
      const d = alongX ? t : colW
      b.box(mat, bx, (hh - drop) / 2, bz, w, hh + drop, d, wall)
      if (ring === 0) addCollider(bx, bz, w, d, hh, 0, -drop)
      // Grass cap with a lip over the inner face, and drips hanging off it.
      b.box(mat, bx + (nx * lip) / 2, hh, bz + (nz * lip) / 2, w + Math.abs(nx) * lip, 1.2, d + Math.abs(nz) * lip, cap)
      const faceX = cx - nx * ring * t + nx * 0.25
      const faceZ = cz - nz * ring * t + nz * 0.25
      const drips = 1 + Math.floor(rand() * 3)
      for (let k = 0; k < drips; k++) {
        const dw = 0.8 + rand() * 1.4
        const dl = 0.8 + rand() * 3.2
        const u = (rand() - 0.5) * (colW - dw)
        b.box(mat, faceX + ux * u, hh - 0.6 - dl / 2, faceZ + uz * u, alongX ? dw : 0.5, dl, alongX ? 0.5 : dw, rand() < 0.5 ? cap : capDark)
      }
      if (ring === 1 && rand() < 0.25) roundTree(b, mat, rand, bx, hh + 0.6, bz, 1.1 + rand() * 0.4, tree)
    }
  }
}

function buildWalls(b, mat, rand) {
  const { minX, maxX, minZ, maxZ, lane, wallHeight } = ARENA
  const e = ARENA.wallThickness * 2 // overrun so the corners close
  cliffRun(b, mat, rand, minX - e, minZ, maxX + e, minZ, 0, 1, wallHeight) // north
  cliffRun(b, mat, rand, maxX, minZ, maxX, maxZ, -1, 0, wallHeight) // east
  cliffRun(b, mat, rand, minX, maxZ, minX, minZ, 1, 0, wallHeight) // west
  cliffRun(b, mat, rand, minX - e, maxZ, lane.minX, maxZ, 0, -1, wallHeight) // south, west of the lane
  cliffRun(b, mat, rand, lane.maxX, maxZ, maxX + e, maxZ, 0, -1, wallHeight) // south, east of the lane
  // Lane walls, one run per section so each takes its section's colours.
  for (let i = 0; i < LANE.sections; i++) {
    const z0 = sectionStart(i)
    const z1 = sectionStart(i + 1)
    const pal = themeOf(i)
    cliffRun(b, mat, rand, lane.minX, z0, lane.minX, z1, 1, 0, lane.wallHeight, lane.drop, pal)
    cliffRun(b, mat, rand, lane.maxX, z0, lane.maxX, z1, -1, 0, lane.wallHeight, lane.drop, pal)
  }
  cliffRun(b, mat, rand, lane.minX - e, lane.endZ, lane.maxX + e, lane.endZ, 0, -1, { min: 6, max: 10 }, lane.drop, themeOf(LANE.sections - 1))
}

// Section i spans [sectionStart(i), sectionStart(i + 1)] along z; it matches ZONES[i] on the HUD bar.
export const sectionStart = (i) => LANE.originZ + i * LANE.sectionLength
const themeOf = (i) => LANE_THEMES[i]

// --- Kick lane -------------------------------------------------------------------------
// LANE.sections equal sections, one per HUD zone, each with its own lawns, centre path, trees and
// wall colours (see laneSections.js for the boundary labels).
function buildLane(b, mat, rand) {
  const { maxZ, lane } = ARENA
  const cx = (lane.minX + lane.maxX) / 2
  const pathW = 8
  const side = (lane.maxX - lane.minX - pathW) / 2 - 1.4
  const dy = -lane.drop
  buildRamp(b, mat)
  for (let i = 0; i < LANE.sections; i++) {
    const th = LANE_THEMES[i]
    const z0 = i === 0 ? maxZ + RAMP_LEN : sectionStart(i)
    const z1 = sectionStart(i + 1)
    const len = z1 - z0
    const cz = (z0 + z1) / 2
    const pal = { lawn: th.lawn, curb: th.curb, tuft: th.tuft, rock: th.rock }
    lawn(b, mat, rand, [[lane.minX + 0.7 + side / 2, cz, side, len - 1.4]], 0, dy, pal)
    lawn(b, mat, rand, [[lane.maxX - 0.7 - side / 2, cz, side, len - 1.4]], 0, dy, pal)
    if (th.path) b.box(mat, cx, dy + 0.02, cz, pathW, 0.04, len - 0.4, th.path) // visual only: the floor is already walkable
    for (let z = z0 + 8, k = 0; z < z1 - 4; z += 12, k++) {
      for (const x of [lane.minX + 3.5, lane.maxX - 3.5]) {
        const pine = th.tree.kind === 'pine' || (th.tree.kind === 'mix' && (k + (x < cx ? 0 : 1)) % 2)
        if (pine) pineTree(b, mat, rand, x, 0.14 + dy, z, 1 + rand() * 0.3, th.tree)
        else roundTree(b, mat, rand, x, 0.14 + dy, z, 0.9 + rand() * 0.3, th.tree)
      }
    }
  }
}

// A full-width ramp from the hub down into the sunken lane, built from 0.1 m treads
// (walkable: well under the step-up) so it reads as a smooth slope with no gaps.
const RAMP_LEN = 12
function buildRamp(b, mat) {
  const { maxZ, lane } = ARENA
  const n = Math.round(lane.drop / 0.1)
  const run = RAMP_LEN / n
  const w = lane.maxX - lane.minX
  const cx = (lane.minX + lane.maxX) / 2
  const h = (lane.drop + KICK_STRIP_H) / n // tread height, starting flush with the kick strip's top
  for (let i = 0; i < n - 1; i++) {
    const top = KICK_STRIP_H - h * (i + 1)
    const z = maxZ + run * (i + 0.5)
    b.box(mat, cx, (top - lane.drop) / 2, z, w, top + lane.drop, run + 0.02, COLORS.sand)
    addCollider(cx, z, w, run, top, 0, -lane.drop)
  }
}

// --- Lawns ---------------------------------------------------------------------------------
// Flush grass slab(s) inside a thin orange outline (the outline is every rect grown by
// `rim`, so stepped shapes get one continuous border), dotted with tufts and blue rocks.
function lawn(b, mat, rand, rects, rot = 0, dy = 0, pal = {}) {
  const { lawn: lawnColor = COLORS.lawn, curb = COLORS.curb } = pal
  const rim = 0.45
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  for (const [x, z, w, d] of rects) {
    b.box(mat, x, 0.05 + dy, z, w + 2 * rim, 0.1, d + 2 * rim, curb, rot)
    b.box(mat, x, 0.07 + dy, z, w, 0.14, d, lawnColor, rot)
    addCollider(x, z, w, d, 0.14 + dy, rot, dy)
  }
  for (const [x, z, w, d] of rects) {
    const n = Math.round((w * d) / 28)
    for (let i = 0; i < n; i++) {
      const lx = (rand() - 0.5) * (w - 1.6)
      const lz = (rand() - 0.5) * (d - 1.6)
      const px = x + c * lx + s * lz
      const pz = z - s * lx + c * lz
      if (!clearOfSites(px, pz, 5)) continue
      if (rand() < 0.7) tuft(b, mat, rand, px, pz, dy, pal.tuft)
      else rocks(b, mat, rand, px, pz, dy, pal.rock)
    }
  }
}

// Kick strip: pale strip across the plaza's south edge, where it meets the lane mouth.
const KICK_STRIP_H = 0.06
function buildKickStrip(b, mat) {
  const { minX, maxX, maxZ } = ARENA
  // Runs right up to the ramp's first tread (z = maxZ + 0.01 overlap) so there is no gap.
  b.box(mat, (minX + maxX) / 2, KICK_STRIP_H / 2, maxZ - 4.5 + 0.005, maxX - minX, KICK_STRIP_H, 9.01, COLORS.sand)
}

function tuft(b, mat, rand, x, z, dy = 0, cols = [COLORS.grassDark, COLORS.leaf]) {
  const blades = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < blades; i++) {
    const h = 0.5 + rand() * 0.7
    b.box(mat, x + (rand() - 0.5) * 0.7, 0.14 + dy + h / 2, z + (rand() - 0.5) * 0.7, 0.18, h, 0.18, rand() < 0.5 ? cols[0] : cols[1], rand() * Math.PI)
  }
}

function rocks(b, mat, rand, x, z, dy = 0, cols = [COLORS.rock, '#93acec']) {
  const n = 2 + Math.floor(rand() * 3)
  for (let i = 0; i < n; i++) {
    const s = 0.5 + rand() * 0.6
    b.box(mat, x + (rand() - 0.5) * 1.4, 0.14 + dy + s / 2, z + (rand() - 0.5) * 1.4, s, s, s, i % 2 ? cols[0] : cols[1], rand())
  }
}

// --- Spawn pad --------------------------------------------------------------------------------
// A pixelated football seen from above: the pad's cells sample the ball pattern
// on a hemisphere whose pole is a pentagon centre.
function buildSpawnPad(b, mat) {
  const R = SPAWN_PAD_RADIUS
  const cell = 0.45
  const n = Math.ceil(R / cell)
  const up = pentagonAxis()
  // Tangent frame around the pentagon axis.
  let t1 = [up[2], 0, -up[0]]
  const l1 = Math.hypot(...t1)
  t1 = t1.map((v) => v / l1)
  const t2 = [up[1] * t1[2] - up[2] * t1[1], up[2] * t1[0] - up[0] * t1[2], up[0] * t1[1] - up[1] * t1[0]]
  const colors = [COLORS.padWhite, COLORS.padDark, COLORS.padSeam]
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const x = i * cell
      const z = j * cell
      const r = Math.hypot(x, z)
      if (r > R) continue
      if (r > R - cell * 1.3) {
        b.box(mat, x, 0.2, z, cell, 0.4, cell, COLORS.padRim)
        continue
      }
      const a = x / (R * 1.02)
      const c = z / (R * 1.02)
      const y = Math.sqrt(Math.max(0, 1 - a * a - c * c))
      const dir = [0, 1, 2].map((k) => t1[k] * a + up[k] * y + t2[k] * c)
      b.box(mat, x, 0.275, z, cell, 0.55, cell, colors[soccerPanel(dir[0], dir[1], dir[2])])
    }
  }
  // Two squares, one turned 45 degrees: an octagon close to the disc.
  addCollider(0, 0, R * 1.66, R * 1.66, 0.55, 0)
  addCollider(0, 0, R * 1.66, R * 1.66, 0.55, Math.PI / 4)
}

// --- Trees ---------------------------------------------------------------------------------------
// Topiary tree: thin trunk through three stacked, rounded leaf blobs.
export function roundTree(b, mat, rand, x, y0, z, s = 1, pal = {}) {
  const { leaf = COLORS.leaf, leafDark = COLORS.leafDark, trunk = COLORS.trunk } = pal
  const trunkH = 7 * s
  b.box(mat, x, y0 + trunkH / 2, z, 0.7 * s, trunkH, 0.7 * s, trunk)
  for (let k = 0; k < 3; k++) {
    const size = (3.6 - k * 0.95) * s
    const y = y0 + (2.8 + k * 2.3) * s
    const h = 1.7 * s
    const col = (k + Math.floor(rand() * 2)) % 2 ? leafDark : leaf
    b.box(mat, x, y, z, size, h, size, col)
    b.box(mat, x, y, z, size + 0.8 * s, h * 0.6, size - 0.8 * s, col)
    b.box(mat, x, y, z, size - 0.8 * s, h * 0.6, size + 0.8 * s, col)
  }
  if (y0 < 1) addCollider(x, z, 0.7 * s, 0.7 * s, y0 + trunkH)
}

export function pineTree(b, mat, rand, x, y0, z, s = 1, pal = {}) {
  const { leaf = COLORS.pine, leafDark = COLORS.pineDark, trunk = COLORS.trunk } = pal
  b.box(mat, x, y0 + 1.2 * s, z, 0.9 * s, 2.4 * s, 0.9 * s, trunk)
  for (let k = 0; k < 5; k++) {
    const size = (4.4 - k * 0.85) * s
    b.box(mat, x, y0 + (2.4 + k * 1.15) * s, z, size, 1.3 * s, size, k % 2 ? leafDark : leaf)
  }
  b.box(mat, x, y0 + 8.4 * s, z, 0.6 * s, 0.8 * s, 0.6 * s, leaf)
  if (y0 < 1) addCollider(x, z, 0.9 * s, 0.9 * s, y0 + 8 * s)
}

function clearOfSites(x, z, radius) {
  if (Math.hypot(x, z) < SPAWN_PAD_RADIUS + 2) return false
  for (const site of Object.values(SITES)) if (Math.hypot(x - site.x, z - site.z) < radius) return false
  return true
}

function scatterTrees(b, mat, rand) {
  const { minX, maxX, minZ, maxZ, lane } = ARENA
  const spots = []
  for (let x = minX + 5; x <= maxX - 5; x += 8) spots.push([x, minZ + 4 + rand() * 2])
  for (let z = minZ + 12; z <= maxZ - 5; z += 9) spots.push([minX + 4 + rand() * 2, z])
  for (let z = minZ + 12; z <= maxZ - 5; z += 9) spots.push([maxX - 4 - rand() * 2, z])
  for (let x = minX + 12; x <= lane.minX - 4; x += 9) spots.push([x, maxZ - 4 - rand() * 2])
  for (let x = lane.maxX + 6; x <= maxX - 12; x += 9) spots.push([x, maxZ - 4 - rand() * 2])
  for (const [x, z] of spots) {
    if (!clearOfSites(x, z, 8)) continue
    if (Math.hypot(x - SITES.upgrades.x, z - SITES.upgrades.z) < 22) continue
    roundTree(b, mat, rand, x, 0, z, 0.95 + rand() * 0.35)
  }
}
