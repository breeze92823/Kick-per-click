import { inputState } from './input.js'
import { getYaw, syncYawToPlayer } from './camera.js'
import { baseFloor, floorUnder, pushOut } from './colliders.js'
import { ARENA, GROUND_Y, PHYSICS, PLAYER_DIMS, SPAWN, SPAWN_FACING, WORLD_BOUNDS } from './config.js'

// The local player singleton, mutated in place. Kinematic capsule stepped once
// per frame: input -> gravity -> integrate -> walls/props -> floor. Solid
// props live in colliders.js; their tops count as floor.
export const player = {
  position: { x: 0, y: 0, z: 0 }, // capsule base (feet)
  velocity: { x: 0, y: 0, z: 0 },
  grounded: true,
  facing: Math.PI, // yaw the character model faces, radians
  moveSpeed: PHYSICS.moveSpeed,
  dims: { ...PLAYER_DIMS },
  padTarget: null, // { x, z } training-pad spot being walked to / parked on
  walkTarget: null, // { x, z } auto-walk goal (Auto Kick heading for the kick strip); any move/jump input cancels it
  atPad: false, // reached padTarget: planted, facing the goal, kick animation on click
}

const PAD_WALK_SPEED = 3 // m/s auto-walk to the pad spot
const PAD_ARRIVE = 0.05 // m from the spot that counts as arrived
const PAD_FACING = -Math.PI / 2 // goals lie west (-X) of their pads
let padNeedsNeutral = false

export function parkOnPad(x, z) {
  player.padTarget = { x, z }
  player.atPad = false
}

export function walkTo(x, z) {
  if (!player.padTarget) player.walkTarget = { x, z }
}

export function releasePad() {
  player.padTarget = null
  player.atPad = false
}

let sinceGrounded = 0 // s since the feet last touched floor (coyote time)
let jumpBuffered = 0 // s left on a remembered jump press

export function resetPlayer(spawn = SPAWN, facing = SPAWN_FACING) {
  player.position.x = spawn.x
  player.position.y = spawn.y
  player.position.z = spawn.z
  player.velocity.x = player.velocity.y = player.velocity.z = 0
  player.grounded = true
  player.facing = facing
  player.padTarget = null
  player.walkTarget = null
  player.atPad = false
  sinceGrounded = 0
  jumpBuffered = 0
}

export function respawn() {
  resetPlayer()
  syncYawToPlayer()
}

// Without feetY (camera boom) it is the bare ground height there.
export const floorAt = (x, z, feetY) => (feetY === undefined ? baseFloor(x ?? 0, z ?? 0) : floorUnder(x, z, feetY))

const TAU = Math.PI * 2
// Turns angle `from` toward `to` by at most maxDelta, the short way round.
function rotateTowards(from, to, maxDelta) {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from))
  if (Math.abs(diff) <= maxDelta) return to
  return (from + Math.sign(diff) * maxDelta) % TAU
}

// Moves the (x, z) velocity toward the target as one 2D vector so it curves
// straight instead of warping axis-by-axis.
function approach2D(v, targetX, targetZ, maxDelta) {
  const dx = targetX - v.x
  const dz = targetZ - v.z
  const dist = Math.hypot(dx, dz)
  if (dist <= maxDelta || dist === 0) {
    v.x = targetX
    v.z = targetZ
  } else {
    v.x += (dx / dist) * maxDelta
    v.z += (dz / dist) * maxDelta
  }
}

export function step(dt) {
  if (dt <= 0) return

  // Camera-relative ground basis.
  const yaw = getYaw()
  const fwdX = -Math.sin(yaw)
  const fwdZ = -Math.cos(yaw)
  const rightX = Math.cos(yaw)
  const rightZ = -Math.sin(yaw)
  const mv = inputState.move
  const len = Math.hypot(mv.x, mv.z)
  const scale = len > 1 ? 1 / len : 1
  let wishX = (fwdX * mv.z + rightX * mv.x) * scale
  let wishZ = (fwdZ * mv.z + rightZ * mv.x) * scale
  let speed = player.moveSpeed
  let moving = len > 0.01

  // Parked on a training pad: auto-walk to its spot (input ignored), then stay planted and
  // facing the goal until a fresh move/jump press frees the player.
  const pad = player.padTarget
  if (pad) {
    if (!player.atPad) {
      const dx = pad.x - player.position.x
      const dz = pad.z - player.position.z
      const d = Math.hypot(dx, dz)
      if (d < PAD_ARRIVE) {
        player.position.x = pad.x
        player.position.z = pad.z
        player.velocity.x = player.velocity.z = 0
        player.atPad = true
        padNeedsNeutral = len > 0.01 || inputState.jump // a key held from the walk-in must be released first
      } else {
        wishX = dx / d
        wishZ = dz / d
        speed = Math.min(PAD_WALK_SPEED, d * 6)
        moving = true
        inputState.jump = false
      }
    }
    if (player.atPad) {
      if (!moving && !inputState.jump) padNeedsNeutral = false
      else if (!padNeedsNeutral) releasePad()
      if (player.atPad) {
        wishX = wishZ = 0
        moving = false
        inputState.jump = false
      }
    }
  }

  // Auto-walk to the kick strip (Auto Kick): input steers away from it, otherwise head straight there.
  const goal = player.walkTarget
  if (goal) {
    const dx = goal.x - player.position.x
    const dz = goal.z - player.position.z
    const d = Math.hypot(dx, dz)
    if (len > 0.01 || inputState.jump || d < 0.5 || player.padTarget) player.walkTarget = null
    else {
      wishX = dx / d
      wishZ = dz / d
      speed = Math.min(player.moveSpeed, Math.max(2, d * 4))
      moving = true
    }
  }

  // Snappy start, slightly softer stop; both scale with the walk speed.
  const rate = (moving ? PHYSICS.accel : PHYSICS.decel) * Math.max(1, player.moveSpeed / PHYSICS.moveSpeed)
  approach2D(player.velocity, wishX * speed, wishZ * speed, rate * dt)

  // Jump: a press is buffered briefly, and allowed a moment after leaving a ledge.
  if (inputState.jump) {
    jumpBuffered = PHYSICS.jumpBuffer
    inputState.jump = false
  }
  jumpBuffered = Math.max(0, jumpBuffered - dt)
  sinceGrounded = player.grounded ? 0 : sinceGrounded + dt
  if (jumpBuffered > 0 && sinceGrounded <= PHYSICS.coyoteTime) {
    player.velocity.y = PHYSICS.jumpSpeed
    jumpBuffered = 0
    sinceGrounded = PHYSICS.coyoteTime + 1 // no double jump from the coyote window
  }
  player.grounded = false

  const p = player.position
  player.velocity.y += PHYSICS.gravity * dt
  p.x += player.velocity.x * dt
  p.y += player.velocity.y * dt
  p.z += player.velocity.z * dt

  const r = player.dims.radius
  p.x = Math.max(WORLD_BOUNDS.minX + r, Math.min(WORLD_BOUNDS.maxX - r, p.x))
  // The lane is for the ball only: the player stops at the kick strip's south edge (the ramp's top).
  p.z = Math.max(WORLD_BOUNDS.minZ + r, Math.min(Math.min(WORLD_BOUNDS.maxZ, ARENA.maxZ) - r, p.z))

  pushOut(p, r, player.dims.height)

  const groundY = floorAt(p.x, p.z, p.y)
  if (p.y <= groundY) {
    p.y = groundY
    if (player.velocity.y < 0) player.velocity.y = 0
    player.grounded = true
  }

  if (p.y < PHYSICS.killY) {
    respawn()
    return
  }

  // Turn at a fixed rate toward the heading. Clicking to kick never turns the
  // player: the juggle plays in whatever direction they already face.
  if (player.atPad) player.facing = rotateTowards(player.facing, PAD_FACING, PHYSICS.turnSpeed * dt)
  else if (Math.hypot(wishX, wishZ) > 0.05) {
    player.facing = rotateTowards(player.facing, Math.atan2(wishX, wishZ), PHYSICS.turnSpeed * dt)
  }
}
