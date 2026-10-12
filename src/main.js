import { Clock, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { ARENA, CAMERA, ECONOMY, GRAPHICS_PRESETS, KICKBALL, SPAWN, SPAWN_FACING } from './config.js'
import * as bloxity from './bloxity.js'
import { inputState, install as installInput, setControlsLocked, setWindowOpen } from './input.js'
import { player, resetPlayer, step as stepPlayer } from './player.js'
import { enterAimView, exitAimView, isCameraBusy, syncYawToPlayer, update as updateCamera } from './camera.js'
import { createFog, createGround, createLights, createSky } from './world.js'
import { createPlayerAvatar } from './playerAvatar.js'
import { isTouch } from './device.js'
import { createVoxelBuilder } from './voxels.js'
import { buildArena } from './arena.js'
import { createLandmarks } from './landmarks.js'
import { createHud } from './hud.js'
import { createBallKick } from './ballKick.js'
import { initNet, net, sendPose, syncAvatar } from './net.js'
import { createRemotePlayers } from './remotePlayers.js'
import { addWins, stats, tickPlaytime, winsForDistance } from './stats.js'

// --- Bloxity + player state -----------------------------------------------
bloxity.init()
resetPlayer(SPAWN, SPAWN_FACING)
syncYawToPlayer()

// --- Renderer / scene -------------------------------------------------------
const basePreset = GRAPHICS_PRESETS[bloxity.settings.graphics_quality] ?? GRAPHICS_PRESETS.High
// Phones: no MSAA and a capped pixel ratio keep a steady frame rate.
const preset = isTouch ? { ...basePreset, antialias: false, dpr: Math.min(basePreset.dpr, 1.5) } : basePreset

const renderer = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr))
document.body.appendChild(renderer.domElement)
installInput(bloxity.showMenu, renderer.domElement)

const scene = new Scene()
scene.fog = createFog()
const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
camera.position.set(0, 12, 24)

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

const sky = createSky()
scene.add(sky, createGround())
const lights = createLights()
scene.add(lights.hemi, lights.sun, lights.sun.target)

// The map: static voxel scenery is merged after every builder has added its boxes.
const voxels = createVoxelBuilder()
buildArena(voxels)
let hud = null
const landmarks = createLandmarks(scene, voxels, (text, ok = true) => hud?.toast(text, !ok)) // ball buy / equip results, same banner as every other message
voxels.build(scene)
hud = createHud()

const avatar = createPlayerAvatar(scene)
const remotePlayers = createRemotePlayers(scene)
const _ball = new Vector3()
// Screen position (px) of a world point, or null behind the camera.
function toScreen(p) {
  _ball.set(p.x, p.y, p.z).project(camera)
  if (_ball.z > 1) return null
  return { x: (_ball.x * 0.5 + 0.5) * window.innerWidth, y: (-_ball.y * 0.5 + 0.5) * window.innerHeight }
}
const ballKick = createBallKick(scene, avatar, {
  onLaunch: (power) => {
    const r = KICKBALL.ratings.find((x) => power >= x.min)
    hud.kickFx.rating(r.text, r.tier)
  },
  onFly: (metres, p) => hud.kickFx.distance(metres, toScreen(p)),
  onBounce: () => hud.kickFx.bounce(),
  onLanded: (metres) => {
    const wins = winsForDistance(metres)
    addWins(wins)
    hud.kickFx.distanceDone(metres)
    hud.toast(`${metres.toFixed(1)} m  +${wins} Wins`)
  },
})
let inLane = false
// Every kick (click, F, KICK!, auto): in the kick zone it launches the ball, elsewhere it juggles if idle.
// Parked on a training pad: the player swings at the pad's ball and it flies into the goal.
hud.setOnKick((power) => {
  if (inLane) return ballKick.kick(power)
  if (player.atPad) return avatar.kickSwing(landmarks.shootTrainingBall)
  return avatar.juggle()
})
// The "+N" kick power pop floats up from the player's head, like Clean Leaves' +Power pops.
const _head = new Vector3()
hud.setHeadAnchor(() => {
  _head.set(player.position.x, player.position.y + 2.4, player.position.z).project(camera)
  if (_head.z > 1) return null // behind the camera
  return { x: (_head.x * 0.5 + 0.5) * window.innerWidth, y: (-_head.y * 0.5 + 0.5) * window.innerHeight }
})
let aimOn = false
let controlsLocked = false
hud.setBusyCheck(() => ballKick.busy)
// Tap to Kick: swing to the ball-follow view while aiming; cancelling restores the old orbit.
hud.setOnAim((on) => {
  aimOn = on
  if (on) {
    player.facing = 0 // face down the lane (+Z)
    enterAimView()
  } else exitAimView()
})

bloxity.onSetting((key, value) => {
  if (key === 'graphics_quality') renderer.shadowMap.enabled = (GRAPHICS_PRESETS[value] ?? GRAPHICS_PRESETS.High).shadows
})

// --- Loop -------------------------------------------------------------------
const clock = new Clock()
let sceneReady = false
let avatarReady = false
avatar.whenLoaded(() => {
  avatarReady = true
})

let elapsed = 0
let actionWasHeld = false
let autoClickTimer = 0
let onPad = false
let wasNearWheel = false

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  elapsed += dt
  stepPlayer(dt)
  hud.setPrompt(landmarks.update(dt, elapsed))
  const nearWheel = landmarks.atWheel()
  if (nearWheel && !wasNearWheel) hud.openWheel() // opens once per visit; walk off and back to reopen
  wasNearWheel = nearWheel
  if (!!player.padTarget !== onPad) avatar.setBallHeld(!(onPad = !!player.padTarget)) // the ball is on the pad's spot, not in the hands
  inLane = player.position.z > ARENA.maxZ - 9 && player.position.x > ARENA.minX && player.position.x < ARENA.maxX // kick strip, ramp and lane
  hud.setLane(inLane)
  // Controls stay locked from the aim meter until the ball has landed and the camera is back.
  // An open HUD window (rebirth, wheel, legends) also freezes movement, camera look and zoom.
  const winOpen = hud.windowOpen()
  if (winOpen !== document.body.classList.contains('win-open')) {
    document.body.classList.toggle('win-open', winOpen)
    setWindowOpen(winOpen) // frees the cursor while the window is up
  }
  const lock = aimOn || ballKick.busy || isCameraBusy() || winOpen
  if (lock !== controlsLocked) setControlsLocked((controlsLocked = lock))

  // A click on the world (or F) is one kick, same as the KICK! button (not while a window is open).
  if (inputState.action && !actionWasHeld && !winOpen) hud.doKick()
  actionWasHeld = inputState.action
  // Planted on a training pad: kicks come automatically, each gaining the pad's multiplier (x1, x5, ...).
  // Pad kicks come every ECONOMY.padKickInterval seconds.
  const onPadKick = player.atPad && stats.field
  if (stats.autoClick || onPadKick) {
    autoClickTimer -= dt
    if (autoClickTimer <= 0) {
      autoClickTimer += onPadKick ? ECONOMY.padKickInterval : ECONOMY.autoClickInterval
      hud.autoKick()
    }
  } else autoClickTimer = 0
  tickPlaytime(dt)

  ballKick.update(dt)
  avatar.update(dt)
  sendPose(player, Math.hypot(player.velocity.x, player.velocity.z))
  remotePlayers.update(dt, player.position)
  updateCamera(camera, dt)
  sky.position.copy(camera.position)
  lights.follow(player.position.x, player.position.z)
  renderer.render(scene, camera)
  sceneReady = true
  if (sceneReady && avatarReady) bloxity.notifyFirstFrame() // tells the portal loading is done
})

bloxity.onAvatarChanged(syncAvatar)
bloxity.onProportionsChanged(syncAvatar)
initNet() // multiplayer + server saves; offline when no server is reachable

window.addEventListener('beforeunload', bloxity.teardown)

// Dev-only console hook, e.g. __game.teleport(10, 0, -5)
if (import.meta.env.DEV) {
  window.__game = { player, net, teleport: (x, y, z, facing = player.facing) => { resetPlayer({ x, y, z }, facing); syncYawToPlayer() } }
}
