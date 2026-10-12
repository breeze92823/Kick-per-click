import { Clock, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { ARENA, CAMERA, ECONOMY, GRAPHICS_PRESETS, SPAWN, SPAWN_FACING } from './config.js'
import * as bloxity from './bloxity.js'
import { inputState, install as installInput, setControlsLocked } from './input.js'
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
const landmarks = createLandmarks(scene, voxels)
voxels.build(scene)
const hud = createHud()

const avatar = createPlayerAvatar(scene)
const ballKick = createBallKick(scene, avatar, (metres) => {
  const wins = winsForDistance(metres)
  addWins(wins)
  hud.toast(`${metres.toFixed(1)} m  +${wins} Wins`)
})
let inLane = false
// Every kick (click, F, KICK!, auto): in the kick zone it launches the ball, elsewhere it juggles if idle.
// Parked on a training pad: the player swings at the pad's ball and it flies into the goal.
hud.setOnKick((power) => {
  if (inLane) return ballKick.kick(power)
  if (player.atPad) return avatar.kickSwing(landmarks.shootTrainingBall)
  return avatar.juggle()
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

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  elapsed += dt
  stepPlayer(dt)
  hud.setPrompt(landmarks.update(dt, elapsed))
  if (!!player.padTarget !== onPad) avatar.setBallHeld(!(onPad = !!player.padTarget)) // the ball is on the pad's spot, not in the hands
  inLane = player.position.z > ARENA.maxZ - 9 && player.position.x > ARENA.minX && player.position.x < ARENA.maxX // kick strip, ramp and lane
  hud.setLane(inLane)
  // Controls stay locked from the aim meter until the ball has landed and the camera is back.
  const lock = aimOn || ballKick.busy || isCameraBusy()
  if (lock !== controlsLocked) setControlsLocked((controlsLocked = lock))

  // A click on the world (or F) is one kick, same as the KICK! button.
  if (inputState.action && !actionWasHeld) hud.doKick()
  actionWasHeld = inputState.action
  if (stats.autoClick) {
    autoClickTimer -= dt
    if (autoClickTimer <= 0) {
      autoClickTimer += ECONOMY.autoClickInterval
      hud.autoKick()
    }
  } else autoClickTimer = 0
  tickPlaytime(dt)

  ballKick.update(dt)
  avatar.update(dt)
  updateCamera(camera, dt)
  sky.position.copy(camera.position)
  lights.follow(player.position.x, player.position.z)
  renderer.render(scene, camera)
  sceneReady = true
  if (sceneReady && avatarReady) bloxity.notifyFirstFrame() // tells the portal loading is done
})

window.addEventListener('beforeunload', bloxity.teardown)

// Dev-only console hook, e.g. __game.teleport(10, 0, -5)
if (import.meta.env.DEV) {
  window.__game = { player, teleport: (x, y, z, facing = player.facing) => { resetPlayer({ x, y, z }, facing); syncYawToPlayer() } }
}
