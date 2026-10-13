// Deterministic kick flight. A kick is a first arc with a set peak height, then a chain of equal "skip"
// arcs between BOUNCE! rings that keep the ball up and moving, and a last arc down to the floor. The
// forward speed is constant (a ring only re-lifts the ball), so it follows directly from the total
// flight time and the distance to cover: the last arc lands exactly on `target`.
// Pure maths (no three.js) so ballKick.js can follow the plan and it can be checked in isolation.

// o: { g, z0, y0, yLand, target (landing z), apex (m above y0), rings, ringHeight (0..1 of the peak above
// the floor), rise (0..1: height each skip climbs above its ring, as a share of that peak) }
// Steering: x0 (launch x), steer { accel, maxSpeed }, xLimit (|x| bound), reach, minShift, rand() -> [0,1).
// Returns { segments: [{ z, y, vy, vz, T, t0 }], rings: [{ x, y, z, t }], time }.
// Segment i starts at (z, y) with velocity (vz, vy) and lasts T s (until the next ring, or the floor).
export function planFlight(o) {
  const { g } = o
  const vy0 = Math.sqrt(2 * g * o.apex)
  const peak = o.y0 + o.apex - o.yLand // peak height above the floor
  const ringY = o.yLand + o.ringHeight * peak
  const lift = Math.sqrt(2 * g * o.rise * peak) // vertical speed a ring gives
  const fall = (vy, y, y1) => (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * (y - y1)))) / g // time to descend from y to y1

  // Times: first arc to the first ring, skips ring to ring, last arc from the last ring to the floor.
  const n = ringY - o.yLand >= o.ringRadius + 1 ? o.rings : 0 // no rings if they would sit too low
  const tFirst = fall(vy0, o.y0, n ? ringY : o.yLand)
  const tSkip = fall(lift, ringY, ringY)
  const tLast = fall(lift, ringY, o.yLand)
  const time = n ? tFirst + (n - 1) * tSkip + tLast : tFirst
  const vz = (o.target - o.z0) / time

  // Lateral reach of the steering in T s (accelerate to maxSpeed, then cruise), scaled by `reach` for margin.
  const { accel, maxSpeed } = o.steer
  const covered = (T) => (T >= maxSpeed / accel ? maxSpeed * T - (maxSpeed * maxSpeed) / (2 * accel) : 0.5 * accel * T * T)
  const clampX = (x) => Math.max(-o.xLimit, Math.min(o.xLimit, x))
  let prevX = clampX(o.x0)

  const segments = []
  const rings = []
  let z = o.z0
  let y = o.y0
  let vy = vy0
  let t0 = 0
  for (let k = 0; k <= n; k++) {
    const T = k === n ? (n ? tLast : tFirst) : k === 0 ? tFirst : tSkip
    segments.push({ z, y, vy, vz, T, t0 })
    if (k === n) break
    z += vz * T
    y = ringY
    t0 += T
    // Random lateral spot the player can steer to in time, kept away from the previous ring.
    const reach = o.reach * covered(T)
    const lo = Math.max(-o.xLimit, prevX - reach)
    const hi = Math.min(o.xLimit, prevX + reach)
    let x = lo + o.rand() * (hi - lo)
    if (Math.abs(x - prevX) < o.minShift) {
      const dir = prevX - lo > hi - prevX ? -1 : 1
      x = prevX + dir * Math.min(o.minShift, dir > 0 ? hi - prevX : prevX - lo)
    }
    prevX = x
    rings.push({ x, y: ringY, z, t: t0 })
    vy = lift
  }
  return { segments, rings, time }
}

// Picks a spot on a planned flight for the Bonus Win ring: a random moment in [from, to] of the flight time, at
// least `gap` s from every BOUNCE! ring, high enough to clear the floor, and laterally within steering reach
// of the ring before it. o: { g, yLand, ringRadius, steer, x0, xLimit, reach, from, to, gap, rand }.
// Returns { x, y, z, t } or null.
export function planBonus(plan, o) {
  const { accel, maxSpeed } = o.steer
  const covered = (T) => (T >= maxSpeed / accel ? maxSpeed * T - (maxSpeed * maxSpeed) / (2 * accel) : 0.5 * accel * T * T)
  for (let tries = 0; tries < 16; tries++) {
    const t = plan.time * (o.from + o.rand() * (o.to - o.from))
    if (plan.rings.some((r) => Math.abs(r.t - t) < o.gap)) continue
    let i = plan.segments.length - 1
    while (i > 0 && plan.segments[i].t0 > t) i--
    const s = plan.segments[i]
    const l = t - s.t0
    const y = s.y + s.vy * l - 0.5 * o.g * l * l
    if (y < o.yLand + o.ringRadius + 0.5) continue
    let from = { x: o.x0, t: 0 }
    for (const r of plan.rings) if (r.t < t) from = r
    const reach = o.reach * covered(t - from.t)
    const lo = Math.max(-o.xLimit, from.x - reach)
    const hi = Math.min(o.xLimit, from.x + reach)
    return { x: lo + o.rand() * (hi - lo), y, z: s.z + s.vz * l, t }
  }
  return null
}
