import { inputState } from './input.js'
import { player, floorAt } from './player.js'
import { segmentClear } from './colliders.js'
import { Quaternion, Vector3 } from 'three'
import { ARENA, CAMERA, KICKBALL, PHYSICS } from './config.js'

// Third-person chase camera, ported from +1 Cut Grass Adventure. It owns its own
// yaw/pitch (right-drag) and orbits the player, so the movement keys never steer
// the view. ONE smoothing stage, on the point it follows: position and look-at
// both derive from it, so they cannot disagree (separate rates read as jitter).
// The wheel sets a zoom target that glides; speed pulls the boom back and widens
// the FOV; solid props pull the boom in until clear.
const state = { yaw: 0, pitch: CAMERA.startPitch }
const FLOOR_MARGIN = 0.3 // m the camera stays above the surface under it
const TELEPORT_DISTANCE = 15 // a same-frame jump bigger than this is a respawn: snap

// Driven by the Bloxity `camera_sensitivity` setting.
let sensitivity = 1
export function setCameraSensitivity(value) {
  sensitivity = value
}

// Extra FOV (degrees) from other systems (e.g. an action punch).
let fovExtra = 0
export function setFovExtra(degrees) {
  fovExtra = degrees
}

const followed = { x: 0, y: 0, z: 0 } // smoothed feet position
const lastPlayerPos = { x: 0, y: 0, z: 0 }
const look = { x: 0, y: 0, z: 0 }
let initialised = false
let zoomTarget = CAMERA.distance // what the wheel asked for
let zoomEased = CAMERA.distance
let rush = 0 // eased 0..1 speed factor
let clearance = 1 // 0..1 of the boom the walls allow, eased back out

export function getYaw() {
  return state.yaw
}

// Snaps the orbit to sit directly behind the player.
export function syncYawToPlayer() {
  state.yaw = player.facing + Math.PI
}

// Ball follow, ported from Stone-Skipping's cameraOrbit.js. On a kick the orbit
// swings to a low, close view behind the player (setKickView). While the ball is
// tracked the camera holds that pose and only slides along Z with the ball (no
// re-aim; orbit/zoom input is consumed but not seen). On release it eases back with
// the normal follow smoothing (position 12/s, aim 20/s).
let tracked = null
let trackStartZ = 0
const frozen = { pos: new Vector3(), quat: new Quaternion(), hasPose: false }
const lastPos = new Vector3() // pose at the end of the previous frame
const lastQuat = new Quaternion()
const chaseQuat = new Quaternion()
let returning = false
// Ball cam state (see CAMERA.ballCam): a smoothed copy of the ball, blended in from the chase pose.
const bc = { active: false, t: 0, speed: 0, fovExtra: 0, pos: new Vector3(), prev: new Vector3(), startPos: new Vector3(), startQuat: new Quaternion() }
const bcLook = new Vector3()
const POSITION_SMOOTHING = 12
const LOOK_SMOOTHING = 20

// True while the camera follows the ball or is still easing back to the chase pose.
export const isCameraBusy = () => !!tracked || returning

// Pass the ball's position object to follow it, or null to release.
export function setTrackTarget(target) {
  if (target === tracked) return
  returning = !target
  tracked = target
  frozen.hasPose = false
  bc.active = false
}

// Swings the orbit to the throw view: behind the player, rotated, low and close.
export function setKickView() {
  state.yaw = player.facing + Math.PI + KICKBALL.viewYawOffset
  state.pitch = KICKBALL.viewPitch
  zoomTarget = KICKBALL.viewDistance
}

// Aiming (the Tap to Kick meter) uses the same view as the ball follow; cancelling
// puts the orbit back where the player had it.
let savedView = null
export function enterAimView() {
  savedView ??= { yaw: state.yaw, pitch: state.pitch, zoom: zoomTarget }
  setKickView()
}
export function exitAimView() {
  if (!savedView) return
  state.yaw = savedView.yaw
  state.pitch = savedView.pitch
  zoomTarget = savedView.zoom
  savedView = null
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

// Low chase view behind the ball. Reads the chase pose already on `camera` as the blend start.
function applyBallCam(camera, dt) {
  const B = CAMERA.ballCam
  if (!bc.active) {
    bc.active = true
    bc.t = 0
    bc.speed = 0
    bc.pos.copy(tracked)
    bc.prev.copy(tracked)
    bc.startPos.copy(camera.position)
    bc.startQuat.copy(camera.quaternion)
  }
  if (dt > 0) {
    const inst = bc.prev.distanceTo(tracked) / dt
    bc.speed += (inst - bc.speed) * (1 - Math.exp(-6 * dt))
    const kxz = 1 - Math.exp(-B.followXZ * dt)
    const ky = 1 - Math.exp(-B.followY * dt)
    bc.pos.x += (tracked.x - bc.pos.x) * kxz
    bc.pos.z += (tracked.z - bc.pos.z) * kxz
    bc.pos.y += (tracked.y - bc.pos.y) * ky
  }
  bc.prev.copy(tracked)

  // Lane runs down +Z; stay inside the walls and above the ground.
  const maxX = ARENA.lane.maxX - B.laneMargin
  const cx = clamp(bc.pos.x, -maxX, maxX)
  const cz = bc.pos.z - B.distance
  const cy = Math.max(bc.pos.y + B.height, floorAt(cx, cz) + FLOOR_MARGIN + 0.5)
  camera.position.set(cx, cy, cz)
  bcLook.set(clamp(bc.pos.x, -maxX, maxX), bc.pos.y + B.lookRise, bc.pos.z + B.lookAhead)
  camera.lookAt(bcLook)

  if (bc.t < 1) {
    bc.t = Math.min(1, bc.t + dt / B.blendTime)
    const s = bc.t * bc.t * (3 - 2 * bc.t)
    camera.position.lerpVectors(bc.startPos, camera.position, s)
    camera.quaternion.copy(bc.startQuat).slerp(camera.quaternion, s)
  }
}

export function update(camera, dt) {
  state.yaw -= inputState.look.dx * CAMERA.lookSensitivity * sensitivity
  state.pitch += inputState.look.dy * CAMERA.lookSensitivity * sensitivity
  inputState.look.dx = 0
  inputState.look.dy = 0
  state.pitch = clamp(state.pitch, CAMERA.minPitch, CAMERA.maxPitch)

  zoomTarget = clamp(zoomTarget + inputState.zoom * CAMERA.zoomStep, CAMERA.minDistance, CAMERA.maxDistance)
  inputState.zoom = 0

  const p = player.position
  const jump = Math.hypot(p.x - lastPlayerPos.x, p.y - lastPlayerPos.y, p.z - lastPlayerPos.z)
  const teleported = initialised && jump > TELEPORT_DISTANCE
  lastPlayerPos.x = p.x
  lastPlayerPos.y = p.y
  lastPlayerPos.z = p.z
  if (teleported) {
    state.yaw = player.facing + Math.PI
    state.pitch = CAMERA.startPitch
  }

  if (!initialised || teleported) {
    followed.x = p.x
    followed.y = p.y
    followed.z = p.z
    clearance = 1
    initialised = true
  } else {
    const t = dt > 0 ? 1 - Math.exp(-CAMERA.followLerp * dt) : 1
    followed.x += (p.x - followed.x) * t
    followed.y += (p.y - followed.y) * t
    followed.z += (p.z - followed.z) * t
  }

  // Speed framing: pulling back has to lag the speed change or every stop punches the camera in.
  const speed = Math.hypot(player.velocity.x, player.velocity.z)
  const targetRush = clamp(speed / player.moveSpeed, 0, 1)
  rush += (targetRush - rush) * (1 - Math.exp(-CAMERA.speedEase * dt))
  zoomEased += (zoomTarget - zoomEased) * (1 - Math.exp(-CAMERA.zoomEase * dt))

  const distance = Math.max(1, zoomEased + CAMERA.speedDistance * rush)
  const ballCamOn = tracked && CAMERA.ballCam.enabled
  const fovTarget = ballCamOn ? CAMERA.ballCam.fovBoost * clamp(bc.speed / CAMERA.ballCam.fovSpeed, 0, 1) : 0
  bc.fovExtra += (fovTarget - bc.fovExtra) * (1 - Math.exp(-CAMERA.ballCam.fovEase * dt))
  const fov = CAMERA.fov + CAMERA.speedFov * rush + fovExtra + bc.fovExtra
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }

  look.x = followed.x
  look.y = followed.y + player.dims.height * CAMERA.targetHeight
  look.z = followed.z

  const cp = Math.cos(state.pitch)
  const px = look.x + Math.sin(state.yaw) * cp * distance
  const py = Math.max(look.y + Math.sin(state.pitch) * distance, floorAt(look.x + Math.sin(state.yaw) * cp * distance, look.z + Math.cos(state.yaw) * cp * distance) + FLOOR_MARGIN)
  const pz = look.z + Math.cos(state.yaw) * cp * distance

  // Never inside a solid: pull in to the first one between the player and the
  // camera at once, and ease back out once it is clear.
  const hit = segmentClear(look.x, look.y, look.z, px, py, pz, followed.y + PHYSICS.stepUp)
  const want = hit < 1 ? Math.max(0.08, hit - 0.06) : 1
  clearance = want < clearance ? want : clearance + (want - clearance) * (1 - Math.exp(-CAMERA.clearEase * dt))

  camera.position.set(
    look.x + (px - look.x) * clearance,
    look.y + (py - look.y) * clearance,
    look.z + (pz - look.z) * clearance,
  )
  camera.lookAt(look.x, look.y, look.z)

  if (tracked && CAMERA.ballCam.enabled) {
    applyBallCam(camera, dt)
  } else if (tracked) {
    // Ball cam disabled: the chase pose is still computed above; the frozen pose replaces it.
    if (!frozen.hasPose) {
      frozen.pos.copy(camera.position)
      frozen.quat.copy(camera.quaternion)
      trackStartZ = tracked.z
      frozen.hasPose = true
    }
    camera.position.set(frozen.pos.x, frozen.pos.y, frozen.pos.z + (tracked.z - trackStartZ))
    camera.quaternion.copy(frozen.quat)
  } else if (returning) {
    // Ease from where the ball cam left the camera to the chase pose.
    camera.position.lerpVectors(lastPos, camera.position, 1 - Math.exp(-POSITION_SMOOTHING * dt))
    chaseQuat.copy(camera.quaternion)
    camera.quaternion.copy(lastQuat).slerp(chaseQuat, 1 - Math.exp(-LOOK_SMOOTHING * dt))
    if (lastPos.distanceTo(camera.position) < 0.01) returning = false
  }
  lastPos.copy(camera.position)
  lastQuat.copy(camera.quaternion)
}
