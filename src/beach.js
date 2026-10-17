// Beach World: a sandy copy of the plaza and kick lane, centred on BEACH.cx (east of the arena, same z range so the
// lane physics are shared). The north wall is replaced by the sea: a sand shore players can wade into up to a buoy
// line. Static scenery goes into the voxel builder (one merged mesh per material, so detail costs vertices, not
// draw calls); the sea and its foam are three meshes animated by createBeachFx. The landmarks (training, wheel,
// upgrades, boards...) are built per world in landmarks.js, the 2X wins in main.js.
import { BufferAttribute, CanvasTexture, Color, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace } from 'three'
import { addCollider } from './colliders.js'
import { ARENA, BEACH, LANE, LAWNS, SITES, SPAWN_PAD_RADIUS } from './config.js'
import { studMaterial } from './materials.js'
import { makeCanvas, mulberry32 } from './textures.js'
import { buildRamp, cliffRun, lawn, RAMP_LEN, sectionStart } from './arena.js'
import { duneGrass, palm, shrub, surfboard, tikiTorch, umbrella } from './palms.js'

const C = BEACH.colors
const PAL = { wall: C.cliff, cap: C.cap, capDark: C.capDark, tree: { palm: true, leaf: C.palm, leafDark: C.palmDark, trunk: C.trunk } }
const TAU = Math.PI * 2
const HEADLAND = 20 // m the side cliffs run out into the sea past the plaza's north edge

// Voxel boxes only yaw, so a prop's parts are placed in its own frame: (lx, lz) -> world, matching voxels.box's rotY.
const frame = (x, z, rot) => {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  return (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz]
}

// --- Plants ---------------------------------------------------------------------------------------------------------
// --- Props ------------------------------------------------------------------------------------------------------------
// Sun lounger with a raised backrest, along its local z; rot turns it.
function lounger(b, mat, x, z, rot, cushion) {
  const at = frame(x, z, rot)
  for (const [lx, lz] of [[-0.3, -0.85], [0.3, -0.85], [-0.3, 0.85], [0.3, 0.85]]) b.box(mat, ...xyz(at, lx, 0.15, lz), 0.1, 0.3, 0.1, '#e8e8f0', rot)
  b.box(mat, ...xyz(at, 0, 0.33, 0), 0.78, 0.08, 2.0, '#f2f2f5', rot)
  b.box(mat, ...xyz(at, 0, 0.42, 0.25), 0.68, 0.1, 1.4, cushion, rot)
  b.box(mat, ...xyz(at, 0, 0.6, -0.72), 0.68, 0.36, 0.3, cushion, rot)
  b.box(mat, ...xyz(at, 0, 0.86, -0.9), 0.68, 0.3, 0.22, cushion, rot)
  addCollider(x, z, 0.8, 2, 0.5, rot)
}
const xyz = (at, lx, y, lz) => {
  const [wx, wz] = at(lx, lz)
  return [wx, y, wz]
}

function towel(b, mat, x, z, color, rot) {
  b.box(mat, x, 0.08, z, 1.1, 0.04, 2.2, color, rot)
  b.box(mat, x, 0.1, z, 1.1, 0.04, 0.3, '#ffffff', rot)
}

// Rock-ringed tide pool from overlapping rects [dx, dz, w, d]: wet rim, shallow water, a deeper centre, and rocks
// along the outline (skipping points that fall inside a neighbouring rect). Low enough to wade through.
function tidePool(b, mat, rand, x, z, parts) {
  const inside = (px, pz, skip) => parts.some((p, i) => i !== skip && Math.abs(px - p[0]) < p[2] / 2 - 0.3 && Math.abs(pz - p[1]) < p[3] / 2 - 0.3)
  for (const [dx, dz, w, d] of parts) b.box(mat, x + dx, 0.07, z + dz, w + 1.2, 0.04, d + 1.2, C.wetSand)
  for (const [dx, dz, w, d] of parts) b.box(mat, x + dx, 0.1, z + dz, w, 0.06, d, C.waterLight)
  for (const [dx, dz, w, d] of parts) b.box(mat, x + dx, 0.12, z + dz, w * 0.6, 0.04, d * 0.55, C.water)
  parts.forEach(([dx, dz, w, d], pi) => {
    const per = 2 * (w + d)
    const n = Math.round(per / 2)
    for (let i = 0; i < n; i++) {
      const u = (i / n) * per
      let px, pz
      if (u < w) [px, pz] = [-w / 2 + u, -d / 2]
      else if (u < w + d) [px, pz] = [w / 2, -d / 2 + (u - w)]
      else if (u < 2 * w + d) [px, pz] = [w / 2 - (u - w - d), d / 2]
      else [px, pz] = [-w / 2, d / 2 - (u - 2 * w - d)]
      if (inside(dx + px, dz + pz, pi)) continue
      const sz = 0.4 + rand() * 0.6
      b.box(mat, x + dx + px + (rand() - 0.5) * 0.4, 0.06 + sz * 0.35, z + dz + pz + (rand() - 0.5) * 0.4, sz, sz * 0.7, sz * (0.8 + rand() * 0.4), rand() < 0.5 ? C.rock : C.rockLight, rand())
    }
  })
  // A starfish and some weed in the water.
  b.box(mat, x + parts[0][0] + 0.8, 0.16, z + parts[0][1], 0.5, 0.04, 0.12, '#ff7a3a', 0.3)
  b.box(mat, x + parts[0][0] + 0.8, 0.16, z + parts[0][1], 0.5, 0.04, 0.12, '#ff7a3a', 1.35)
  for (let i = 0; i < 6; i++) b.box(mat, x + parts[0][0] + (rand() - 0.5) * parts[0][2] * 0.6, 0.2, z + parts[0][1] + (rand() - 0.5) * parts[0][3] * 0.5, 0.1, 0.3 + rand() * 0.3, 0.1, '#3f8a3a', rand())
}

// Lifeguard tower looking out to sea (north): stilts, braced, a railed deck, back wall to the land, roof, ladder, flag.
function lifeguardTower(b, mat, x, z) {
  for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) b.box(mat, x + dx, 1.6, z + dz, 0.4, 3.2, 0.4, '#f2f2f5')
  b.box(mat, x, 1.4, z - 1.4, 3.2, 0.3, 0.3, '#ff4a3d')
  b.box(mat, x, 1.4, z + 1.4, 3.2, 0.3, 0.3, '#ff4a3d')
  b.box(mat, x - 1.4, 1.4, z, 0.3, 0.3, 3.2, '#ff4a3d')
  b.box(mat, x + 1.4, 1.4, z, 0.3, 0.3, 3.2, '#ff4a3d')
  b.box(mat, x, 3.3, z, 4, 0.3, 4, C.wood)
  b.box(mat, x, 3.9, z - 1.9, 4, 0.9, 0.2, '#ffffff') // front rail
  b.box(mat, x - 1.9, 3.9, z, 0.2, 0.9, 3.6, '#ffffff')
  b.box(mat, x + 1.9, 3.9, z, 0.2, 0.9, 3.6, '#ffffff')
  b.box(mat, x, 4.9, z + 1.8, 4, 2.9, 0.3, '#ff4a3d') // back wall (land side)
  b.box(mat, x, 4.9, z + 1.95, 2.4, 0.5, 0.05, '#ffffff') // stripe
  for (const dx of [-1.9, 1.9]) b.box(mat, x + dx, 4.8, z - 1.9, 0.25, 2.6, 0.25, '#f2f2f5')
  b.box(mat, x, 6.3, z, 4.8, 0.35, 4.6, '#ff4a3d')
  b.box(mat, x, 6.6, z, 3.6, 0.3, 3.4, '#ffffff')
  b.box(mat, x, 6.85, z, 2.2, 0.25, 2.0, '#ff4a3d')
  for (let k = 0; k < 6; k++) b.box(mat, x + 0.6, 0.4 + k * 0.55, z + 2.35, 1.2, 0.12, 0.12, C.wood) // ladder
  for (const dx of [0.05, 1.15]) b.box(mat, x + dx, 1.7, z + 2.35, 0.12, 3.4, 0.12, C.woodDark)
  b.box(mat, x + 2.3, 4.5, z - 2.3, 0.1, 9, 0.1, '#e8e8f0') // flag pole
  b.box(mat, x + 2.85, 8.5, z - 2.3, 1.0, 0.6, 0.05, '#ff4a3d')
  b.box(mat, x + 2.85, 8.5, z - 2.3, 1.0, 0.2, 0.06, '#ffd21f')
  b.box(mat, x - 2.6, 1, z - 1, 0.5, 2, 0.15, '#ff4a3d', 0.2) // rescue board
  addCollider(x, z, 3.6, 3.6, 3.3)
}

function sandcastle(b, mat, x, z) {
  b.box(mat, x, 0.4, z, 5, 0.8, 4, '#e8cd92')
  b.box(mat, x, 1.2, z, 3, 0.8, 2.4, '#f0d7a0')
  b.box(mat, x, 2.1, z, 1.6, 1, 1.4, '#f6e2b0')
  for (const [dx, dz] of [[-2.2, -1.7], [2.2, -1.7], [-2.2, 1.7], [2.2, 1.7]]) {
    b.box(mat, x + dx, 1.1, z + dz, 1.1, 2.2, 1.1, '#e8cd92')
    for (const [cx, cz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) b.box(mat, x + dx + cx, 2.35, z + dz + cz, 0.4, 0.3, 0.4, '#f6e2b0') // battlements
  }
  for (let i = -2; i <= 2; i++) b.box(mat, x + i * 1.0, 1.75, z - 1.25, 0.4, 0.3, 0.3, '#f0d7a0')
  b.box(mat, x, 0.6, z - 2.05, 0.9, 1.0, 0.15, '#9a7a4a') // gate
  b.box(mat, x, 0.06, z, 7, 0.04, 6, C.wetSand) // moat
  b.box(mat, x, 3.2, z, 0.12, 1.4, 0.12, '#ffffff')
  b.box(mat, x + 0.4, 3.6, z, 0.7, 0.45, 0.04, '#ff4a3d')
  b.box(mat, x + 3.2, 0.3, z + 1.5, 0.7, 0.6, 0.7, '#ff4a3d') // bucket
  b.box(mat, x + 3.2, 0.62, z + 1.5, 0.75, 0.06, 0.75, '#ffd21f')
  b.box(mat, x + 3.7, 0.12, z + 0.6, 0.25, 0.08, 1.2, '#2f8cff', 0.4) // spade
  addCollider(x, z, 5.4, 4.4, 1)
}

function driftwood(b, mat, rand, x, z) {
  const a = rand() * Math.PI
  const at = frame(x, z, a)
  b.box(mat, x, 0.22, z, 3.2, 0.38, 0.42, C.drift, a)
  b.box(mat, ...xyz(at, 1.2, 0.3, 0.4), 0.9, 0.24, 0.24, '#8f7d68', a + 0.8)
  b.box(mat, ...xyz(at, -1.7, 0.25, 0), 0.3, 0.46, 0.5, '#8f7d68', a)
}

// Small floor clutter: shells, starfish, pebbles.
function shell(b, mat, rand, x, z) {
  const k = rand()
  if (k < 0.35) {
    b.box(mat, x, 0.1, z, 0.4, 0.08, 0.16, '#ff9ec7', rand() * 3)
    b.box(mat, x, 0.12, z, 0.2, 0.08, 0.3, '#ffd6e6', rand() * 3)
  } else if (k < 0.6) {
    for (let i = 0; i < 3; i++) b.box(mat, x, 0.1, z, 0.55, 0.07, 0.14, '#ff7a3a', (i * Math.PI) / 3 + rand())
  } else {
    const n = 2 + Math.floor(rand() * 2)
    for (let i = 0; i < n; i++) {
      const s = 0.3 + rand() * 0.45
      b.box(mat, x + (rand() - 0.5) * 1.1, 0.06 + s * 0.35, z + (rand() - 0.5) * 1.1, s, s * 0.7, s, i % 2 ? C.rock : C.rockLight, rand())
    }
  }
}

// Boardwalk: staggered planks along z on low joists, two tones.
function boardwalk(b, mat, rand, cx, cz, w, d) {
  const plank = 1.1
  const len = 2.4
  for (let i = 0; i < Math.floor(w / plank); i++) {
    for (let j = 0; j < Math.ceil(d / len) + 1; j++) {
      const off = i % 2 ? len / 2 : 0
      const zs = Math.max(cz - d / 2, cz - d / 2 + j * len - off)
      const z1 = Math.min(cz + d / 2, cz - d / 2 + j * len - off + len - 0.06)
      if (z1 - zs < 0.3) continue
      b.box(mat, cx - w / 2 + (i + 0.5) * plank, 0.11, (zs + z1) / 2, plank - 0.07, 0.06, z1 - zs, rand() < 0.5 ? C.wood : '#b57d46')
    }
  }
  for (const side of [-1, 1]) b.box(mat, cx + side * (w / 2 - 0.1), 0.06, cz, 0.2, 0.08, d, C.woodDark) // side joists
}

// Beach-ball pad at the plaza centre, in place of the arena's football pad.
function spawnPad(b, mat, cx) {
  const R = SPAWN_PAD_RADIUS
  const cell = 0.45
  const n = Math.ceil(R / cell)
  const stripes = ['#ff4a3d', '#ffffff', '#ffd21f', '#ffffff', '#2f8cff', '#ffffff']
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const x = i * cell
      const z = j * cell
      const r = Math.hypot(x, z)
      if (r > R) continue
      if (r > R - cell * 1.3) b.box(mat, cx + x, 0.2, z, cell, 0.4, cell, '#2a7fb8')
      else b.box(mat, cx + x, 0.275, z, cell, 0.55, cell, r < cell * 1.2 ? '#ffe45a' : stripes[Math.floor(((Math.atan2(z, x) + Math.PI) / TAU) * 6) % 6])
    }
  }
  addCollider(cx, 0, R * 1.66, R * 1.66, 0.55, 0)
  addCollider(cx, 0, R * 1.66, R * 1.66, 0.55, Math.PI / 4)
}

// --- Shore -----------------------------------------------------------------------------------------------------------
// Dry sand -> wrack line -> wet sand under the shallows, a buoy line players can't pass, and boulders where the side
// cliffs run into the sea.
function buildShore(b, mat, rand, cx) {
  const { minX, maxX, minZ } = ARENA
  const w = maxX - minX
  b.box(mat, cx, 0.045, minZ - 1.5, w, 0.05, 3.2, C.sandDark)
  b.box(mat, cx, 0.035, (minZ - 3 + BEACH.buoyZ - 6) / 2, w + 24, 0.05, minZ - 3 - BEACH.buoyZ + 6, C.wetSand)
  for (let i = 0; i < 46; i++) {
    const x = cx + minX + 2 + rand() * (w - 4)
    b.box(mat, x, 0.08, minZ - 2.6 + (rand() - 0.5) * 0.8, 0.5 + rand() * 0.9, 0.05, 0.18, rand() < 0.6 ? '#4f7a3a' : '#7a6a4a', rand() * 0.6 - 0.3) // seaweed wrack
  }
  for (let i = 0; i < 14; i++) driftwood(b, mat, rand, cx + minX + 4 + rand() * (w - 8), minZ - 1 + (rand() - 0.5) * 2)

  // Buoy line: rope and alternating floats; the collider is the swim limit.
  const z = BEACH.buoyZ
  b.box(mat, cx, BEACH.waterY + 0.12, z, w, 0.06, 0.06, '#f2f2f5')
  for (let x = cx + minX + 1.5, i = 0; x < cx + maxX; x += 3, i++) {
    b.box(mat, x, BEACH.waterY + 0.15, z, 0.55, 0.45, 0.55, i % 2 ? '#ffffff' : '#ff4a3d')
    b.box(mat, x, BEACH.waterY + 0.42, z, 0.3, 0.12, 0.3, i % 2 ? '#ff4a3d' : '#ffffff')
  }
  addCollider(cx, z, w + 4, 1.2, 3)

  // Boulders along the cliff feet and around the headland tips.
  for (const side of [-1, 1]) {
    const x0 = cx + side * maxX
    for (let i = 0; i < 22; i++) {
      const s = 0.8 + rand() * 1.8
      const bz = minZ - HEADLAND - 2 + rand() * (HEADLAND + 4)
      const bx = x0 - side * (0.5 + rand() * 2.5)
      b.box(mat, bx, s * 0.35, bz, s, s * 0.8, s * (0.8 + rand() * 0.4), rand() < 0.5 ? C.rock : C.rockLight, rand())
    }
    for (let i = 0; i < 10; i++) {
      const s = 1.2 + rand() * 2.4
      b.box(mat, x0 - side * ARENA.wallThickness * rand() * 2, s * 0.3, minZ - HEADLAND - 1 - rand() * 4, s, s * 0.8, s, rand() < 0.5 ? C.rock : '#7a8698', rand())
    }
  }
}

// --- Assembly ----------------------------------------------------------------------------------------------------------
export function buildBeach(b) {
  const mat = studMaterial()
  const rand = mulberry32(777)
  const { minX, maxX, minZ, maxZ, lane, wallHeight } = ARENA
  const cx = BEACH.cx
  const e = ARENA.wallThickness * 2

  // Sand over the plaza floor, darker strip at the lane mouth, and faint wind ripples.
  b.box(mat, cx, 0.03, (minZ + maxZ) / 2, maxX - minX, 0.06, maxZ - minZ, C.sand)
  b.box(mat, cx, 0.04, maxZ - 4.5, maxX - minX, 0.05, 9, C.sandDark)
  for (let i = 0; i < 70; i++) {
    const x = cx + minX + 3 + rand() * (maxX - minX - 6)
    const z = minZ + 3 + rand() * (maxZ - minZ - 14)
    b.box(mat, x, 0.065, z, 1.5 + rand() * 2.5, 0.01, 0.16, '#eed6a0', 0.25 + rand() * 0.2)
  }

  // Cliffs on three sides; the side cliffs run out into the sea as headlands, the north is open water.
  cliffRun(b, mat, rand, cx + maxX, minZ - HEADLAND, cx + maxX, maxZ, -1, 0, wallHeight, 0, PAL)
  cliffRun(b, mat, rand, cx + minX, maxZ, cx + minX, minZ - HEADLAND, 1, 0, wallHeight, 0, PAL)
  cliffRun(b, mat, rand, cx + minX - e, maxZ, cx + lane.minX, maxZ, 0, -1, wallHeight, 0, PAL)
  cliffRun(b, mat, rand, cx + lane.maxX, maxZ, cx + maxX + e, maxZ, 0, -1, wallHeight, 0, PAL)
  buildShore(b, mat, rand, cx)

  // The lane: ramp, sand floor in alternating section tones, lane walls, palms, shrubs, grass and flags on the flanks.
  buildRamp(b, mat, cx, C.sand)
  const dy = -lane.drop
  for (let i = 0; i < LANE.sections; i++) {
    const z0 = i === 0 ? maxZ + RAMP_LEN : sectionStart(i)
    const z1 = sectionStart(i + 1)
    b.box(mat, cx, dy + 0.03, (z0 + z1) / 2, lane.maxX - lane.minX, 0.06, z1 - z0, i % 2 ? C.sandDark : C.sand) // visual only: the floor is already walkable
    b.box(mat, cx, dy + 0.07, (z0 + z1) / 2, 8, 0.04, z1 - z0 - 0.4, i % 2 ? C.sand : C.sandDark) // centre track
    cliffRun(b, mat, rand, cx + lane.minX, sectionStart(i), cx + lane.minX, sectionStart(i + 1), 1, 0, lane.wallHeight, lane.drop, PAL)
    cliffRun(b, mat, rand, cx + lane.maxX, sectionStart(i), cx + lane.maxX, sectionStart(i + 1), -1, 0, lane.wallHeight, lane.drop, PAL)
    for (let z = z0 + 8, k = 0; z < z1 - 4; z += 12, k++) {
      for (const [x, side] of [[cx + lane.minX + 3.5, -1], [cx + lane.maxX - 3.5, 1]]) {
        palm(b, mat, rand, x, dy + 0.06, z, 0.9 + rand() * 0.3, { solid: false, lite: true, leanDir: side > 0 ? Math.PI : 0 }) // lean over the lane
        shrub(b, mat, rand, x - side * 0.5, z + 6, 0.8, dy + 0.06, false)
        duneGrass(b, mat, rand, x + side * 1.2, z + 3, dy + 0.06)
        duneGrass(b, mat, rand, x - side * 1.4, z - 3, dy + 0.06)
      }
      if (k % 2) {
        const flagX = cx + (rand() - 0.5) * 6
        b.box(mat, flagX, dy + 1.2, z + 3, 0.12, 2.4, 0.12, '#e8e8f0')
        b.box(mat, flagX + 0.45, dy + 2.1, z + 3, 0.8, 0.5, 0.04, ['#ff4a3d', '#ffd21f', '#2f8cff', '#ff6fd0'][k % 4])
      }
    }
  }
  cliffRun(b, mat, rand, cx + lane.minX - e, lane.endZ, cx + lane.maxX + e, lane.endZ, 0, -1, { min: 6, max: 10 }, lane.drop, PAL)

  // Dune-grass lawns under the landmarks, mirroring the arena's (the northern ones stay open sand down to the sea).
  for (const l of LAWNS) {
    const rects = (l.parts ?? [[l.x, l.z, l.w, l.d]]).filter(([, z]) => z >= BEACH.lawn.minZ).map(([x, z, w, d]) => [x + cx, z, w, d])
    if (rects.length) lawn(b, mat, rand, rects, l.rot ?? 0, 0.03, BEACH.lawn)
  }

  // Spawn pad, boardwalk paths (north-south and east-west), tide pool and lagoon.
  spawnPad(b, mat, cx)
  boardwalk(b, mat, rand, cx, -9, 6.6, 12)
  boardwalk(b, mat, rand, cx, 11, 6.6, 16)
  boardwalk(b, mat, rand, cx - 13, 0, 20, 6.6)
  boardwalk(b, mat, rand, cx + 13, 0, 20, 6.6)
  tidePool(b, mat, rand, cx, -24, [[0, 0, 12, 5], [-4, 1.5, 6, 6], [4.5, -1, 5, 4]])
  tidePool(b, mat, rand, cx, 25, [[0, 0, 12, 6], [-3, 2, 7, 6], [5, 1, 5, 6]])

  // Shore life: umbrellas with loungers and towels, the lifeguard tower, a sandcastle; surfboards, torches inland.
  const sets = [[-38, -41, '#ff6fd0'], [-30, -42, '#2f8cff'], [-17, -42, '#ffd21f'], [16, -42, '#ff4a3d'], [24, -41, '#23cfe6'], [40, -41, '#ff9a1a']]
  for (const [x, z, color] of sets) {
    umbrella(b, mat, cx + x, z, color)
    lounger(b, mat, cx + x + 1.6, z + 0.2, 0.15, color)
    towel(b, mat, cx + x - 1.7, z + 0.4, rand() < 0.5 ? '#ffffff' : color, -0.2 + rand() * 0.4)
  }
  umbrella(b, mat, cx - 12, -25, '#ff6fd0')
  umbrella(b, mat, cx + 12, -25, '#2f8cff')
  lounger(b, mat, cx - 10.4, -24.8, -0.2, '#ff6fd0')
  lounger(b, mat, cx + 13.6, -24.6, 0.25, '#2f8cff')
  lifeguardTower(b, mat, cx + 32, -40)
  sandcastle(b, mat, cx - 24, -43)
  surfboard(b, mat, cx - 7, 8, '#ff4a3d', 0.2)
  surfboard(b, mat, cx - 8.4, 8.4, '#2f8cff', -0.1)
  surfboard(b, mat, cx - 9.8, 8, '#ffd21f', 0.3)
  surfboard(b, mat, cx + 7, -8, '#23cfe6', -0.2)
  surfboard(b, mat, cx + 8.4, -8.4, '#ff6fd0', 0.1)
  for (const [x, z] of [[-5, -10], [5, -10], [-5, 10], [5, 10], [-9, -3], [9, -3], [-9, 3], [9, 3]]) tikiTorch(b, mat, cx + x, z)

  // Palms around the edges (the shore row leaning out to sea), shrubs and grass at the cliff feet, palms around the
  // lagoon, and shells on the sand: all kept clear of landmarks, pools, props and the pad.
  const blocked = [[0, -24, 16, 9], [0, 25, 16, 10], [32, -40, 8, 8], [-24, -43, 9, 8], ...sets.map(([x, z]) => [x, z, 7, 5])]
  const clear = (x, z, r) => {
    if (Math.hypot(x - cx, z) < SPAWN_PAD_RADIUS + 2) return false
    if (Math.abs(x - cx) < 4 && Math.abs(z) < 20) return false // north-south boardwalk
    if (Math.abs(z) < 4 && Math.abs(x - cx) < 24) return false // east-west boardwalk
    for (const s of Object.values(SITES)) if (Math.hypot(x - s.x, z - s.z) < r) return false
    for (const [px, pz, pw, pd] of blocked) if (Math.abs(x - cx - px) < pw / 2 + 1 && Math.abs(z - pz) < pd / 2 + 1) return false
    return true
  }
  const shoreRow = []
  for (let x = minX + 5; x <= maxX - 5; x += 7) shoreRow.push([x + (rand() - 0.5) * 2, minZ + 3.5 + rand() * 3])
  for (const [x, z] of shoreRow) if (clear(cx + x, z, 8)) palm(b, mat, rand, cx + x, 0.06, z, 1.0 + rand() * 0.35, { leanDir: -Math.PI / 2 + (rand() - 0.5) * 0.8 })
  const spots = []
  for (let z = minZ + 12; z <= maxZ - 6; z += 8) spots.push([minX + 4 + rand() * 2, z, Math.PI], [maxX - 4 - rand() * 2, z, 0])
  for (let x = minX + 12; x <= lane.minX - 4; x += 8) spots.push([x, maxZ - 4 - rand() * 2, Math.PI / 2])
  for (let x = lane.maxX + 6; x <= maxX - 10; x += 8) spots.push([x, maxZ - 4 - rand() * 2, Math.PI / 2])
  for (const [x, z, away] of spots) {
    // Lean away from the cliff, toward the plaza.
    if (clear(cx + x, z, 8)) palm(b, mat, rand, cx + x, 0.06, z, 0.95 + rand() * 0.35, { leanDir: away + Math.PI + (rand() - 0.5) * 0.9 })
    const sx = cx + x + (rand() - 0.5) * 4
    const sz = z + 3 + rand() * 2
    if (clear(sx, sz, 6)) shrub(b, mat, rand, sx, sz, 0.9 + rand() * 0.4)
    for (let k = 0; k < 2; k++) {
      const gx = cx + x + (rand() - 0.5) * 6
      const gz = z + (rand() - 0.5) * 6
      if (clear(gx, gz, 5)) duneGrass(b, mat, rand, gx, gz)
    }
  }
  for (const [x, z, a] of [[-8, 31, 0.6], [8, 31, 2.5], [-9, 20, -0.4]]) palm(b, mat, rand, cx + x, 0.06, z, 1.1, { leanDir: a }) // lagoon
  for (let i = 0; i < 260; i++) {
    const x = cx + minX + 3 + rand() * (maxX - minX - 6)
    const z = minZ + 1 + rand() * (maxZ - minZ - 10)
    if (clear(x, z, 6)) (rand() < 0.75 ? shell : duneGrass)(b, mat, rand, x, z)
  }
}

// --- Sea -------------------------------------------------------------------------------------------------------------
// The sea is two flat planes (vertex colours fade turquoise shallows to deep blue, a tiling wave texture scrolls over
// them) and two foam strips that wash in and out. Four draw calls in all, nothing per-vertex animated.
function waveTexture() {
  const c = makeCanvas(256, 256)
  const g = c.getContext('2d')
  g.fillStyle = '#dcebf4'
  g.fillRect(0, 0, 256, 256)
  const rand = mulberry32(31)
  for (let i = 0; i < 70; i++) {
    const x = rand() * 256
    const y = rand() * 256
    const w = 18 + rand() * 46
    for (const dx of [-256, 0, 256]) {
      for (const dy of [-256, 0, 256]) {
        g.fillStyle = i % 3 ? 'rgba(255,255,255,0.85)' : 'rgba(150,185,210,0.55)'
        g.beginPath()
        g.ellipse(x + dx, y + dy, w / 2, 1.6 + rand() * 1.6, 0, 0, TAU)
        g.fill()
      }
    }
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  return t
}

function foamTexture() {
  const c = makeCanvas(512, 64)
  const g = c.getContext('2d')
  const rand = mulberry32(57)
  for (let i = 0; i < 420; i++) {
    const x = rand() * 512
    const y = 32 + (rand() - 0.5) * (rand() * 56)
    g.fillStyle = `rgba(255,255,255,${0.35 + rand() * 0.6})`
    g.beginPath()
    g.ellipse(x, y, 4 + rand() * 14, 2 + rand() * 4, 0, 0, TAU)
    g.fill()
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = RepeatWrapping
  return t
}

export function createBeachFx(scene) {
  const { minX, maxX } = ARENA
  const cx = BEACH.cx
  const y = BEACH.waterY
  const shoreZ = BEACH.shoreZ
  const waves = waveTexture()
  const seaMat = new MeshStandardMaterial({ map: waves, vertexColors: true, roughness: 0.3, metalness: 0.05 })
  const shallow = new Color(C.shallow)
  const deep = new Color(C.deep)
  const col = new Color()
  // Flat sea from z0 (south edge) north to z1; uv in world metres so neighbouring planes tile seamlessly.
  const sea = (x0, x1, z0, z1, rows) => {
    const geo = new PlaneGeometry(x1 - x0, z0 - z1, 1, rows)
    geo.rotateX(-Math.PI / 2)
    geo.translate((x0 + x1) / 2, y, (z0 + z1) / 2)
    const pos = geo.attributes.position
    const uv = geo.attributes.uv
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i)
      const pz = pos.getZ(i)
      uv.setXY(i, px / 14, pz / 14)
      col.copy(shallow).lerp(deep, Math.sqrt(Math.min(1, Math.max(0, (shoreZ - pz) / 45))))
      colors.set([col.r, col.g, col.b], i * 3)
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3))
    const m = new Mesh(geo, seaMat)
    scene.add(m)
  }
  // The arena's north cliffs end at z = -58, so the strip between the worlds stops east of them.
  sea(62, 900, shoreZ, -60, 1)
  sea(-900, 900, -60, -120, 6)
  sea(-900, 900, -120, -900, 1)

  const foam = (z, depth, x0, x1) => {
    const geo = new PlaneGeometry(x1 - x0, depth)
    geo.rotateX(-Math.PI / 2)
    geo.translate((x0 + x1) / 2, 0, z)
    const pos = geo.attributes.position
    const uv = geo.attributes.uv
    for (let i = 0; i < pos.count; i++) uv.setX(i, pos.getX(i) / 9)
    const m = new Mesh(geo, new MeshBasicMaterial({ map: foamTexture(), transparent: true, depthWrite: false, opacity: 0.8 }))
    m.position.y = y + 0.02
    scene.add(m)
    return m
  }
  const shoreFoam = foam(shoreZ + 0.3, 2.4, cx + minX - 4, cx + maxX + 4)
  const surf = foam(BEACH.buoyZ - 9, 3.2, cx + minX - 40, cx + maxX + 40)

  return {
    update(t) {
      waves.offset.set(t * 0.006, -t * 0.018)
      const wash = Math.sin(t * 0.7)
      shoreFoam.position.z = wash * 0.9
      shoreFoam.material.opacity = 0.5 + 0.35 * (0.5 + 0.5 * Math.cos(t * 0.7))
      shoreFoam.material.map.offset.x = t * 0.01
      const roll = Math.sin(t * 0.45 + 1.3)
      surf.position.z = roll * 2.5
      surf.material.opacity = 0.35 + 0.35 * (0.5 + 0.5 * roll)
      surf.material.map.offset.x = -t * 0.015
    },
  }
}
