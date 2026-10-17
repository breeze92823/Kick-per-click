// The lane kick: KICK! in the kick zone swings the leg and launches a football down
// the lane on a gravity arc. It lands and stops (no bounce), the distance pops up,
// then the ball and the camera reset to the pre-kick state.
import { Mesh, SphereGeometry } from 'three'
import { ARENA, BALLS, GROUND_Y, KICKBALL as K, LANE, laneCx } from './config.js'
import { ballMaterial } from './materials.js'
import { floorAt, player } from './player.js'
import { inputState } from './input.js'
import { isCameraBusy, setKickView, setTrackTarget } from './camera.js'
import { kickRange, stats } from './stats.js'
import { planBonus, planFlight } from './kickPlan.js'
import { createKickFx } from './kickFx.js'

const B = K.bonusRing
const WALL_MARGIN = K.steer.wallMargin // m the ball keeps from the lane walls

// hooks: { onLanded(metres, ballPosition, bonusPct), onLaunch(power), onFly(metres, ballPosition), onBounce(metres), onBonus(pct), onReset() }
export function createBallKick(scene, avatar, hooks = {}) {
  const fx = createKickFx(scene)
  const kickSfx = new Audio(`${import.meta.env.BASE_URL}audio/ball-kick.mp3`)
  kickSfx.preload = 'auto'
  kickSfx.volume = 0.35 // between the error (0.25) and level-up (0.4) cues
  // Air swoosh (WebAudio, gapless): starts at 2s and loops 2s-4s while the ball is high, then the loop is
  // released on the way down so the rest of the file plays out as the ball lands. Missing file = silent.
  const SWOOSH = { loopStart: 2, loopEnd: 4, volume: 0.3, nearGround: 4, slowSpeed: 8, fastSpeed: 35 } // speeds in m/s // nearGround: m above floor
  let actx = null
  let swooshBuf = null
  let swooshGain = null
  let swooshSrc = null
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    actx = new AC()
    swooshGain = actx.createGain()
    swooshGain.gain.value = SWOOSH.volume
    swooshGain.connect(actx.destination)
    fetch(`${import.meta.env.BASE_URL}audio/swoosh-loop.mp3`)
      .then((r) => r.arrayBuffer())
      .then((b) => actx.decodeAudioData(b))
      .then((buf) => (swooshBuf = buf))
      .catch(() => {})
  } catch {}
  // Ring power-up ping: decoded once, one cheap buffer source per ring. Pitch climbs a little with each ring
  // and the tail is faded out so back-to-back rings don't smear. Missing file = silent.
  const RING_SFX = { volume: 0.3, maxSeconds: 0.7, fade: 0.15, pitchStep: 0.07, maxPitch: 1.5 }
  let ringBuf = null
  try {
    fetch(`${import.meta.env.BASE_URL}audio/powerup.mp3`)
      .then((r) => r.arrayBuffer())
      .then((b) => actx.decodeAudioData(b))
      .then((buf) => (ringBuf = buf))
      .catch(() => {})
  } catch {}
  const playRingSfx = (index) => {
    try {
      if (!ringBuf) return
      actx.resume?.()
      const src = actx.createBufferSource()
      const g = actx.createGain()
      const t = actx.currentTime
      const dur = Math.min(ringBuf.duration, RING_SFX.maxSeconds)
      src.buffer = ringBuf
      src.playbackRate.value = Math.min(RING_SFX.maxPitch, 1 + index * RING_SFX.pitchStep)
      g.gain.setValueAtTime(RING_SFX.volume, t)
      g.gain.setValueAtTime(RING_SFX.volume, t + Math.max(0, dur - RING_SFX.fade))
      g.gain.linearRampToValueAtTime(0, t + dur)
      src.connect(g)
      g.connect(actx.destination)
      src.start(t)
      src.stop(t + dur)
      src.onended = () => g.disconnect()
    } catch {}
  }
  const startSwoosh = () => {
    try {
      stopSwoosh()
      if (!swooshBuf) return
      actx.resume?.()
      swooshSrc = actx.createBufferSource()
      swooshSrc.buffer = swooshBuf
      swooshSrc.loop = true
      swooshSrc.loopStart = SWOOSH.loopStart
      swooshSrc.loopEnd = Math.min(SWOOSH.loopEnd, swooshBuf.duration)
      swooshSrc.connect(swooshGain)
      swooshSrc.start(0, SWOOSH.loopStart)
    } catch {}
  }
  // Loudness follows the ball's speed: silent when slow, full volume at `fastSpeed` m/s.
  const setSwooshSpeed = (speed) => {
    if (!swooshSrc) return
    const k = Math.max(0, Math.min(1, (speed - SWOOSH.slowSpeed) / (SWOOSH.fastSpeed - SWOOSH.slowSpeed)))
    swooshGain.gain.setTargetAtTime(SWOOSH.volume * k * k * (3 - 2 * k), actx.currentTime, 0.05)
  }
  const releaseSwoosh = () => {
    if (swooshSrc) swooshSrc.loop = false // plays on to the end of the file
  }
  function stopSwoosh() {
    try {
      swooshSrc?.stop()
    } catch {}
    swooshSrc = null
  }
  let boosted = false
  const mesh = new Mesh(new SphereGeometry(1, 24, 16), ballMaterial('#f4f4f4', '#1d1d22'))
  mesh.scale.setScalar(K.radius)
  mesh.castShadow = true
  mesh.visible = false
  scene.add(mesh)

  let state = 'idle' // idle | swinging | flying | landed
  let originZ = LANE.originZ // distance is counted from here (or from the launch point if it is further on)
  let timer = 0
  let camHold = 0 // s left to keep following the ball after it lands
  let power = 1 // 0..1 from the aim meter
  const vel = { x: 0, y: 0, z: 0 }
  // The flight plan (kickPlan.js): arcs joined by rings; `seg` is the arc in progress, `ts` the time into it.
  let plan = null
  let ringObjs = []
  let seg = 0
  let ts = 0
  let blocked = false
  let bonus = null // the Bonus Win ring still ahead: { x, y, z, t, tier, obj } (one at most per kick)
  let bonusPct = 0 // % wins earned by flying through it this kick
  let missed = false // a ring was missed: the ball finishes the arc it is on and lands
  let vx = 0 // steering velocity (m/s, + = world +X)
  let cx = 0 // x of the centre line of the lane being kicked down (hub 0, beach BEACH.cx)

  // Full-power range scaled by the aim meter (speed^2), the arc's peak and the number of rings it earns.
  // Planned in lane-local x (relative to cx); launch() shifts the rings to world x once the bonus ring is placed.
  function planKick(range, x0, z0, y0) {
    const { arc, rings } = K
    const apex = arc.minApex + (arc.maxApex - arc.minApex) * Math.pow(Math.min(1, range / LANE.length), arc.curve)
    const flight = planFlight({
      g: K.gravity,
      z0,
      y0,
      yLand: GROUND_Y - ARENA.lane.drop + K.radius,
      target: originZ + range - K.radius,
      apex,
      rings: Math.min(rings.max, Math.floor(range / rings.every)),
      ringHeight: rings.ringHeight,
      rise: rings.rise,
      ringRadius: K.ringRadius,
      x0,
      steer: K.steer,
      xLimit: Math.max(0, ARENA.lane.maxX - WALL_MARGIN - rings.edge),
      reach: rings.reach,
      minShift: rings.minShift,
      rand: Math.random,
    })
    return flight
  }

  function launch() {
    const def = BALLS[stats.equipped] ?? BALLS[0]
    mesh.material = ballMaterial(def.color, def.patch)
    mesh.position.set(player.position.x, player.position.y + K.startHeight, player.position.z + K.startForward)
    originZ = Math.min(LANE.originZ, mesh.position.z)
    cx = laneCx(mesh.position.x)
    const f = 0.5 + 0.5 * Math.min(1, power / K.fullPowerAt) // PERFECT! (>= fullPowerAt) reaches the ball's full range
    const range = kickRange() * f * f
    plan = planKick(range, mesh.position.x - cx, mesh.position.z, mesh.position.y)
    bonus = null
    bonusPct = 0
    if (range >= B.minRange && Math.random() < B.chance) {
      const spot = planBonus(plan, {
        g: K.gravity,
        yLand: GROUND_Y - ARENA.lane.drop + K.radius,
        ringRadius: K.ringRadius,
        steer: K.steer,
        x0: mesh.position.x - cx,
        xLimit: Math.max(0, ARENA.lane.maxX - WALL_MARGIN - K.rings.edge),
        reach: B.reach,
        from: B.from,
        to: B.to,
        gap: B.gap,
        rand: Math.random,
      })
      if (spot) {
        spot.x += cx // world x
        let roll = Math.random() * B.tiers.reduce((a, t) => a + t.weight, 0)
        const tier = B.tiers.find((t) => (roll -= t.weight) < 0) ?? B.tiers[0]
        bonus = { ...spot, tier, obj: fx.spawnBonusRing(spot.x, spot.y, spot.z, tier) }
      }
    }
    for (const r of plan.rings) r.x += cx // world x from here on
    ringObjs = plan.rings.map((r) => fx.spawnRing(r.x, r.y, r.z))
    seg = 0
    ts = 0
    blocked = false
    missed = false
    vx = 0
    mesh.visible = true
    state = 'flying'
    boosted = false
    camHold = 0
    setTrackTarget(mesh.position)
    fx.kickBurst(mesh.position)
    try {
      kickSfx.currentTime = 0
      kickSfx.play()?.catch(() => {})
    } catch {}
    startSwoosh()
    hooks.onLaunch?.(power)
  }

  // Distance of the ball's front edge past the origin; the lane end is exactly LANE.length.
  const metresAt = (p) => Math.max(0, p.z + K.radius - originZ)

  const { maxZ: laneZ, lane: laneBox } = ARENA
  const inner = laneBox.maxX - WALL_MARGIN
  const lastSeg = () => missed || seg === plan.segments.length - 1

  // Mid-air steering: eased acceleration, capped speed, drag when released. Inside the lane, steering toward
  // a wall fades out over `wallSlow` m and the speed toward it is capped the same way, so it never hits it.
  function steer(dt) {
    const S = K.steer
    const p = mesh.position
    const input = inputState.steer
    const inLane = p.z >= laneZ
    const lx = p.x - cx // lane-local x
    const toWall = Math.sign(lx) // +1 near the +X wall, -1 near the -X wall
    const room = inLane ? Math.max(0, Math.min(1, (inner - Math.abs(lx)) / S.wallSlow)) : 1
    const k = room * room * (3 - 2 * room) // smoothstep
    const dir = -input // D / right = world -X when facing down the lane (+Z)
    if (dir) {
      vx += dir * S.accel * (inLane && dir === toWall ? k : 1) * dt
    } else {
      vx -= vx * Math.min(1, S.drag * dt)
    }
    const cap = S.maxSpeed
    vx = Math.max(-cap, Math.min(cap, vx))
    if (inLane && vx * toWall > 0) vx = toWall * Math.min(Math.abs(vx), cap * k) // slow toward the wall
    p.x += vx * dt
    if (inLane && Math.abs(p.x - cx) > inner) {
      p.x = cx + Math.sign(p.x - cx) * inner
      vx = 0
    }
  }

  function fly(dt) {
    const p = mesh.position
    const prevZ = p.z
    ts += dt
    // Passing a planned ring: the next arc starts there with the ring's boost.
    while (!missed && seg < plan.segments.length - 1 && ts >= plan.segments[seg].T) {
      // Only a ball steered through the ring gets the boost; otherwise it carries on down to the floor.
      if (Math.abs(p.x - ringObjs[seg].x) > K.ringRadius) {
        missed = true
        fx.clearRings()
        break
      }
      ts -= plan.segments[seg].T
      fx.hitRing(ringObjs[seg])
      seg++
      boosted = true
      fx.boostBurst(p)
      playRingSfx(seg - 1)
      hooks.onBounce?.()
    }
    // The Bonus Win ring: reached when the flight clock passes its moment; the ball counts if it is inside it.
    if (bonus && !missed && plan.segments[seg].t0 + ts >= bonus.t) {
      if (Math.abs(p.x - bonus.x) <= K.ringRadius) {
        bonusPct = bonus.tier.pct
        fx.hitBonus(bonus.obj)
        playRingSfx(8)
        hooks.onBonus?.(bonusPct)
      } else {
        fx.fadeRing(bonus.obj)
      }
      bonus = null
    }
    const s = plan.segments[seg]
    vel.x = vx
    vel.y = s.vy - K.gravity * ts
    vel.z = s.vz
    p.y = s.y + s.vy * ts - 0.5 * K.gravity * ts * ts
    if (!blocked) p.z = s.z + s.vz * ts
    steer(dt)
    mesh.rotation.x += (vel.z / K.radius) * dt

    // Lane walls and end: the ball stops going forward instead of leaving the lane.
    const { maxZ, lane } = ARENA
    if (prevZ < maxZ && p.z >= maxZ - K.radius && Math.abs(p.x - cx) > inner) {
      p.z = prevZ
      blocked = true
    }
    if (p.z > lane.endZ - K.radius) {
      p.z = lane.endZ - K.radius
      blocked = true
    }
    if (blocked) vel.z = 0

    setSwooshSpeed(Math.hypot(vel.y, vel.z))
    fx.wake(p, vel, boosted)
    hooks.onFly?.(metresAt(p), p)

    const floor = floorAt(p.x, p.z, p.y)
    if (vel.y < 0 && lastSeg() && p.y - K.radius - floor < SWOOSH.nearGround) releaseSwoosh()
    if (lastSeg() && vel.y < 0 && p.y - K.radius <= floor) {
      // Back up to the exact moment the ball met the floor, so the distance doesn't depend on the frame time.
      const tHit = (s.vy + Math.sqrt(s.vy * s.vy + 2 * K.gravity * (s.y - floor - K.radius))) / K.gravity
      if (!blocked) p.z = s.z + s.vz * tHit
      p.y = floor + K.radius
      state = 'landed'
      releaseSwoosh()
      timer = K.landHold
      camHold = K.camHoldAfterLand // camera keeps following the landed ball, then eases back
      fx.clearRings()
      fx.landBurst(p, floor)
      hooks.onLanded?.(metresAt(p), p, bonusPct)
    }
  }

  return {
    get busy() {
      return state !== 'idle'
    },
    // Starts the kick if no ball is in play. Returns whether it did.
    kick(p = 1) {
      if (state !== 'idle') return false
      power = p
      player.facing = 0 // face down the lane (+Z)
      setKickView()
      state = 'swinging'
      avatar.kickSwing(() => {
        avatar.setBallHeld(false)
        launch()
      })
      return true
    },
    update(dt) {
      fx.update(dt)
      if (camHold > 0) {
        camHold -= dt
        if (camHold <= 0) setTrackTarget(null)
      }
      if (state === 'flying') {
        // Two substeps: a fast ball moves over a metre per frame.
        fly(dt / 2)
        if (state === 'flying') fly(dt / 2)
      } else if (state === 'landed') {
        timer -= dt
        if (timer <= 0 && camHold <= 0 && !isCameraBusy()) { // ball stays until the camera has reset
          mesh.visible = false
          fx.clearCrater()
          hooks.onReset?.()
          avatar.setBallHeld(true)
          state = 'idle'
        }
      }
    },
  }
}
