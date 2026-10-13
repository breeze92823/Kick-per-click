import { Clock, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { ARENA, BALLS, CAMERA, ECONOMY, GRAPHICS_PRESETS, KICKBALL, SPAWN, SPAWN_FACING } from './config.js'
import * as bloxity from './bloxity.js'
import { inputState, install as installInput, setControlsLocked, setWindowOpen } from './input.js'
import { player, resetPlayer, step as stepPlayer, walkTo } from './player.js'
import { enterAimView, exitAimView, isCameraBusy, syncYawToPlayer, update as updateCamera } from './camera.js'
import { createFog, createGround, createLights, createSky } from './world.js'
import { createPlayerAvatar } from './playerAvatar.js'
import { isTouch } from './device.js'
import { createVoxelBuilder } from './voxels.js'
import { buildArena } from './arena.js'
import { createLaneSections } from './laneSections.js'
import { createLandmarks } from './landmarks.js'
import { createHud } from './hud.js'
import { createBallKick } from './ballKick.js'
import { initNet, net, remoteBests, sendBest, sendPose, syncAvatar } from './net.js'
import { createRemotePlayers } from './remotePlayers.js'
import { createLegendPet } from './legendPet.js'
import { addWins, kickRange, rangeFor, recordDistance, stats, tickPlaytime, winsForDistance } from './stats.js'
import { createLoading, markLoaded } from './loading.js'
import { createTutorial } from './tutorial.js'

// --- Bloxity + player state -----------------------------------------------
createLoading() // before init(): the portal overlay gets its first step text
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
createLaneSections(scene)
let hud = null
const landmarks = createLandmarks(scene, voxels, (text, ok = true) => hud?.toast(text, !ok)) // ball buy / equip results, same banner as every other message
voxels.build(scene)
hud = createHud()
const tutorial = createTutorial(scene, hud)

const avatar = createPlayerAvatar(scene)
const remotePlayers = createRemotePlayers(scene)
const legendPet = createLegendPet(scene)
const _ball = new Vector3()
// Screen position (px) of a world point, or null behind the camera.
function toScreen(p) {
  _ball.set(p.x, p.y, p.z).project(camera)
  if (_ball.z > 1) return null
  return { x: (_ball.x * 0.5 + 0.5) * window.innerWidth, y: (-_ball.y * 0.5 + 0.5) * window.innerHeight }
}
// Longest-kick markers on the top zone bar: mine plus every other player's, with their Bloxity DP.
function refreshBests() {
  hud.setBests({ metres: stats.bestDistance, pfp: bloxity.getPfp() }, remoteBests())
}
let bestsTimer = 0
let lastKick = null // dev: result of the latest landed kick (__game.lastKick)
const ballKick = createBallKick(scene, avatar, {
  onLaunch: (power) => {
    const r = KICKBALL.ratings.find((x) => power >= x.min)
    hud.kickFx.rating(r.text, r.tier)
  },
  onFly: (metres, p) => hud.kickFx.distance(metres, toScreen(p)),
  onBounce: () => hud.kickFx.bounce(),
  onBonus: (pct) => hud.kickFx.bonus(pct),
  onLanded: (metres, ballPos, bonusPct) => {
    const wins = winsForDistance(metres, bonusPct)
    lastKick = { metres, wins, bonusPct }
    hud.kickFx.distanceDone(metres)
    if (recordDistance(metres)) sendBest(stats.bestDistance)
    refreshBests()
    hud.kickFx.winsReel(wins, toScreen(ballPos), () => addWins(wins)) // wins are credited when the reel locks
  },
  onReset: () => hud.kickFx.hideResult(),
})
let inLane = false
// Every kick (click, F, KICK!, auto): in the kick zone it launches the ball, elsewhere it juggles if idle.
// Parked on a training pad: the player swings at the pad's ball and it flies into the goal.
hud.setOnKick((power) => {
  if (inLane) return ballKick.kick(power)
  if (player.atPad) {
    if (!landmarks.padBallReady()) return false // the last ball is still flying / respawning
    return avatar.kickSwing(landmarks.shootTrainingBall, landmarks.padLeg())
  }
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
let cursorFree = false
hud.setBusyCheck(() => ballKick.busy)
const hudRoot = document.getElementById('hud')
let ballAir = false
// Tap to Kick: swing to the ball-follow view while aiming; cancelling restores the old orbit.
hud.setOnAim((on) => {
  aimOn = on
  avatar.setKickReady(on) // hold the kick wind-up while the Tap to Kick bar is up
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
avatar.whenLoaded(() => markLoaded('avatar'))

let elapsed = 0
let actionWasHeld = false
let autoClickTimer = 0
let autoLaneTimer = 0
let onPad = false
let wasNearWheel = false

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  elapsed += dt
  stepPlayer(dt)
  hud.setPrompt(landmarks.update(dt, elapsed))
  if ((bestsTimer -= dt) < 0) {
    bestsTimer = 0.5
    refreshBests()
  }
  const nearWheel = landmarks.atWheel()
  if (nearWheel && !wasNearWheel) hud.openWheel() // opens once per visit; walk off and back to reopen
  wasNearWheel = nearWheel
  if (!!player.padTarget !== onPad) avatar.setBallHeld(!(onPad = !!player.padTarget)) // the ball is on the pad's spot, not in the hands
  inLane = player.position.z > ARENA.maxZ - 9 && player.position.x > ARENA.minX && player.position.x < ARENA.maxX // kick strip, ramp and lane
  hud.setLane(inLane)
  tutorial.update(elapsed, inLane)
  // Controls stay locked from the aim meter until the ball has landed and the camera is back.
  // An open HUD window (rebirth, wheel, legends) also freezes movement, camera look and zoom.
  const winOpen = hud.windowOpen()
  if (winOpen !== document.body.classList.contains('win-open')) document.body.classList.toggle('win-open', winOpen)
  // The cursor is free while a window or the Tap to Kick meter is up (so they are clickable), mouse-look otherwise.
  if ((winOpen || aimOn) !== cursorFree) setWindowOpen((cursorFree = winOpen || aimOn))
  if (ballKick.busy !== ballAir) hudRoot?.classList.toggle('ball-air', (ballAir = ballKick.busy)) // hide kick buttons while the ball is in the air
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
      autoClickTimer += onPadKick ? ECONOMY.padKickInterval : Math.max(ECONOMY.autoClickInterval, ECONOMY.kickCooldown)
      hud.autoKick(!onPadKick) // Auto Click only gains power; pad kicks still launch the ball
    }
  } else autoClickTimer = 0
  // Auto Kick: keeps taking the Tap to Kick shot in the lane (random 0%-50% power) whenever the ball is free.
  // Not in the lane yet: walk to the kick strip (idle players only; any move input cancels the walk).
  if (stats.autoKick && !inLane && !winOpen && !player.padTarget && !player.walkTarget && !ballKick.busy && !inputState.move.x && !inputState.move.z && player.grounded) {
    walkTo(0, ARENA.maxZ - 4)
  }
  if (stats.autoKick && inLane && !winOpen) {
    autoLaneTimer -= dt
    if (autoLaneTimer <= 0) {
      autoLaneTimer = Math.max(ECONOMY.autoClickInterval, ECONOMY.kickCooldown)
      hud.autoLaneKick()
    }
  } else autoLaneTimer = 0
  tickPlaytime(dt)

  ballKick.update(dt)
  avatar.update(dt)
  const speed = Math.hypot(player.velocity.x, player.velocity.z)
  legendPet.setLegend(stats.legend)
  legendPet.update(dt, player.position, player.facing, Math.min(1, speed / player.moveSpeed))
  sendPose(player, speed, avatar.poseString())
  remotePlayers.update(dt, player.position)
  updateCamera(camera, dt)
  sky.position.copy(camera.position)
  lights.follow(player.position.x, player.position.z)
  renderer.render(scene, camera)
  markLoaded('scene') // once every step is done the portal loading ends (bloxity.notifyFirstFrame)
})

bloxity.onAvatarChanged(syncAvatar)
bloxity.onProportionsChanged(syncAvatar)
initNet() // multiplayer + server saves; offline when no server is reachable

window.addEventListener('beforeunload', bloxity.teardown)

// Dev-only console hook, e.g. __game.teleport(10, 0, -5); __game.range(19, 100) = full-power range of ball #19 at level 100; __game.kick(1) kicks at full aim power, __game.lastKick has the landed distance
if (import.meta.env.DEV) {
  window.__game = { player, net, stats, kick: (power = 1) => ballKick.kick(power), get lastKick() { return lastKick }, resetKick: () => { lastKick = null }, range: (ball, level) => rangeFor(BALLS[ball].kick, level), rangeNow: kickRange, teleport: (x, y, z, facing = player.facing) => { resetPlayer({ x, y, z }, facing); syncYawToPlayer() } }
}
