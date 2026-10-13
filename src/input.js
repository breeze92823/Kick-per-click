// WASD/arrows move (camera-relative, consumed by player.js), right-drag look +
// wheel zoom (consumed by camera.js), edge-triggered jump (cleared by player.js).
// Pointer lock when CONTROLS.pointerLock (on): mouse moves the camera; Esc frees the cursor.
import { CONTROLS } from './config.js'

export const inputState = {
  move: { x: 0, z: 0 }, // x = strafe (+ right), z = forward (+ forward)
  steer: 0, // -1 / 0 / +1 left/right keys, read by the kicked ball even while controls are locked
  look: { dx: 0, dy: 0 }, // raw pixels since the camera last read them
  zoom: 0, // wheel notches since the camera last read them (+ = away)
  jump: false,
  action: false, // primary action held (left mouse on the canvas, or F)
  interact: false, // E pressed since a system last looked
}

// One wheel notch per WheelEvent.deltaMode (pixels, lines, pages), so a trackpad
// and a mouse zoom at the same rate.
const NOTCH_PER_DELTA = [1 / 100, 1 / 3, 1]

const held = new Set()
let orbiting = false // right-drag fallback where pointer lock is refused
let canvas = null
let lockEverGranted = false
let armed = false

const locked = () => !!canvas && document.pointerLockElement === canvas
// Pointer lock can reject (sandboxed frame, post-Escape cooldown); that is not a fault.
let windowOpen = false
// A HUD window is open: hand the cursor back and refuse to retake it until it closes.
export function setWindowOpen(on) {
  windowOpen = on
  if (on && locked()) document.exitPointerLock?.()
  orbiting = false
}

function requestLock() {
  if (windowOpen || !CONTROLS.pointerLock || !canvas || locked()) return
  const r = canvas.requestPointerLock?.()
  if (r instanceof Promise) r.catch(() => {})
}

// While a kick is in progress (meter, flight, camera return), move / jump / look / zoom / interact are ignored;
// only the kick action (click, F) still works. Held keys resume when it unlocks.
let controlsLocked = false
export function setControlsLocked(on) {
  controlsLocked = on
  inputState.jump = false
  inputState.interact = false
  inputState.look.dx = 0
  inputState.look.dy = 0
  inputState.zoom = 0
  recomputeMove()
}

export const isControlsLocked = () => controlsLocked

function recomputeMove() {
  let x = 0
  let z = 0
  // Ball steering stays live while the controls are locked for a kick (A/D or arrows, + = right).
  inputState.steer = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0)
  if (controlsLocked) {
    inputState.move.x = 0
    inputState.move.z = 0
    return
  }
  if (held.has('KeyW') || held.has('ArrowUp')) z += 1
  if (held.has('KeyS') || held.has('ArrowDown')) z -= 1
  if (held.has('KeyD') || held.has('ArrowRight')) x += 1
  if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1
  inputState.move.x = x
  inputState.move.z = z
}

export function install(showMenu, canvasEl) {
  canvas = canvasEl
  document.addEventListener('pointerlockchange', () => {
    if (locked()) {
      lockEverGranted = true
      orbiting = false
    } else {
      inputState.action = false // cursor is back: the HUD is clickable, nothing is held
    }
  })
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return
    if (e.code === 'Escape') showMenu()
    else if (!armed) {
      armed = true // the first keypress is a user gesture: take the mouse without a click
      requestLock()
    }
    held.add(e.code)
    if (e.code === 'Space' && !controlsLocked) inputState.jump = true
    if (e.code === 'KeyF') inputState.action = true
    if (e.code === 'KeyE' && !controlsLocked) inputState.interact = true
    recomputeMove()
  })
  window.addEventListener('keyup', (e) => {
    held.delete(e.code)
    if (e.code === 'KeyF') inputState.action = false
    recomputeMove()
  })
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return // touch.js owns touch (stick, look, buttons)
    const onWorld = e.target.tagName === 'CANVAS'
    if (e.button === 2 && !lockEverGranted) orbiting = true
    if (e.button === 0 && onWorld) {
      // A click on the world takes the cursor (resuming play after Escape) rather than acting.
      armed = true
      requestLock()
      // Retaking the cursor after Escape is not an action; where lock is refused, clicks act as before.
      if (locked() || !lockEverGranted || windowOpen) inputState.action = true
    }
  })
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') return
    if (e.button === 2) orbiting = false
    if (e.button === 0) inputState.action = false
  })
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return
    if (controlsLocked || (!orbiting && !locked())) return
    inputState.look.dx += e.movementX || 0
    inputState.look.dy += e.movementY || 0
  })
  // Only the game world zooms: a wheel aimed at a HUD panel must not also move the camera.
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.target.tagName !== 'CANVAS') return
      e.preventDefault()
      if (controlsLocked) return
      if (document.body.classList.contains('win-open')) return // a window is open: no camera zoom
      inputState.zoom += e.deltaY * (NOTCH_PER_DELTA[e.deltaMode] ?? NOTCH_PER_DELTA[0])
    },
    { passive: false },
  )
  window.addEventListener('contextmenu', (e) => e.preventDefault())
  window.addEventListener('blur', () => {
    held.clear()
    orbiting = false
    inputState.jump = false
    inputState.action = false
    inputState.interact = false
    recomputeMove()
  })
}
