// Solid props as yaw-rotated boxes (oriented on the ground plane). player.js
// asks two things of them: how high the floor is under a point (box tops a
// short step below the feet count as floor) and how far to push the player's
// circle out of any box it walks into.
import { ARENA, GROUND_Y, PHYSICS } from './config.js'

// Bare floor height at (x, z): the kick lane is sunk below the hub.
export function baseFloor(x, z) {
  const { lane, maxZ } = ARENA
  return z >= maxZ && z <= lane.endZ && x >= lane.minX && x <= lane.maxX ? GROUND_Y - lane.drop : GROUND_Y
}

const boxes = []
const pushers = [] // extra (p, radius, height) handlers for non-box solids

export const addPusher = (fn) => pushers.push(fn)

// (cx, cz) centre, w along local X, d along local Z, solid from y0 to y1.
export function addCollider(cx, cz, w, d, y1, rotY = 0, y0 = GROUND_Y) {
  boxes.push({ cx, cz, hx: w / 2, hz: d / 2, y0, y1, cos: Math.cos(rotY), sin: Math.sin(rotY) })
}

// Point into box-local coordinates (inverse of a three.js Y rotation).
function toLocal(b, x, z) {
  const dx = x - b.cx
  const dz = z - b.cz
  return { lx: b.cos * dx - b.sin * dz, lz: b.sin * dx + b.cos * dz }
}

export function floorUnder(x, z, feetY) {
  let floor = baseFloor(x, z)
  for (const b of boxes) {
    if (b.y1 <= floor || b.y1 > feetY + PHYSICS.stepUp) continue
    const { lx, lz } = toLocal(b, x, z)
    if (Math.abs(lx) <= b.hx && Math.abs(lz) <= b.hz) floor = b.y1
  }
  return floor
}

// True if the point is inside a box below its walkable lip (same band pushOut
// treats as solid). Allocation-free: called per flying leaf per frame.
export function insideBox(x, y, z) {
  for (const b of boxes) {
    if (y < b.y0 || y >= b.y1 - PHYSICS.stepUp) continue
    const dx = x - b.cx
    const dz = z - b.cz
    if (Math.abs(b.cos * dx - b.sin * dz) <= b.hx && Math.abs(b.sin * dx + b.cos * dz) <= b.hz) return true
  }
  return false
}

// Pushes position p (feet) out of every box the circle overlaps at body height.
export function pushOut(p, radius, height) {
  for (const b of boxes) {
    if (p.y >= b.y1 - PHYSICS.stepUp || p.y + height <= b.y0) continue
    const { lx, lz } = toLocal(b, p.x, p.z)
    const qx = Math.max(-b.hx, Math.min(b.hx, lx))
    const qz = Math.max(-b.hz, Math.min(b.hz, lz))
    let nx = lx - qx
    let nz = lz - qz
    const dist = Math.hypot(nx, nz)
    if (dist >= radius) continue
    if (dist > 1e-6) {
      nx = (nx / dist) * (radius - dist)
      nz = (nz / dist) * (radius - dist)
    } else {
      // Centre inside the box: leave by the nearest face.
      const ex = b.hx - Math.abs(lx)
      const ez = b.hz - Math.abs(lz)
      if (ex < ez) {
        nx = Math.sign(lx || 1) * (ex + radius)
        nz = 0
      } else {
        nx = 0
        nz = Math.sign(lz || 1) * (ez + radius)
      }
    }
    // Back to world space (forward Y rotation).
    p.x += b.cos * nx + b.sin * nz
    p.z += -b.sin * nx + b.cos * nz
  }
  // Two passes: pushing out of one overlapping pile can land in its neighbour.
  for (let pass = 0; pass < 2; pass++) for (const fn of pushers) fn(p, radius, height)
}

// Fraction (0..1] along the segment a -> b where it first enters a solid, or 1 if
// clear. The chase camera pulls in to this. Boxes whose top is below `minTop` (the
// walkable lips) are ignored, as is any box the start point is already inside, so
// standing on or against a prop never pins the camera to the player.
export function segmentClear(ax, ay, az, bx, by, bz, minTop = 0) {
  let best = 1
  for (const b of boxes) {
    if (b.y1 <= minTop) continue
    const dx = ax - b.cx
    const dz = az - b.cz
    const sx = b.cos * dx - b.sin * dz
    const sz = b.sin * dx + b.cos * dz
    const ex = bx - b.cx
    const ez = bz - b.cz
    const vx = b.cos * ex - b.sin * ez - sx
    const vz = b.sin * ex + b.cos * ez - sz
    const vy = by - ay
    if (Math.abs(sx) <= b.hx && Math.abs(sz) <= b.hz && ay >= b.y0 && ay <= b.y1) continue // starts inside
    let t0 = 0
    let t1 = best
    // Slab test on each axis: [lo, hi] box extent, s start, v delta.
    const axes = [[-b.hx, b.hx, sx, vx], [-b.hz, b.hz, sz, vz], [b.y0, b.y1, ay, vy]]
    for (const [lo, hi, s, v] of axes) {
      if (Math.abs(v) < 1e-9) {
        if (s < lo || s > hi) { t0 = 2; break }
        continue
      }
      let n = (lo - s) / v
      let f = (hi - s) / v
      if (n > f) [n, f] = [f, n]
      if (n > t0) t0 = n
      if (f < t1) t1 = f
      if (t0 > t1) break
    }
    if (t0 <= t1 && t0 < best) best = t0
  }
  return best
}
