// New-player tutorial: a banner under the top bar, a 3D guide (trail of arrowheads + bobbing beacon) toward
// where to go, and a bobbing UI arrow on the button to press. The step lives in stats.tutorialStep, which
// net.js saves with the account; an account saved before the tutorial existed is finished (stats.js), and
// stats.tutorialReady gates it until the server has answered. The step machine is tutorialLogic.js.
import { ExtrudeGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Shape } from 'three'
import './tutorial.css'
import { ARENA, DISABLE_TUTORIAL, SITES, TRAINING_FIELDS, TUTORIAL } from './config.js'
import { player, floorAt } from './player.js'
import { levelCap, onStats, setTutorialStep, stats } from './stats.js'
import { nextStep } from './tutorialLogic.js'
import { isTouch } from './device.js'

const SPACING = 1.1 // m between trail arrows
const SPEED = 1.8 // m/s the trail crawls toward the target
const MAX_ARROWS = 140
const HIDE_WITHIN = 2.5 // m from the target where the trail disappears
const BEACON_HEIGHT = 4.5 // m above the ground the big arrow floats

// The x1 goal's training spot (landmarks.js buildTraining: the row runs along world z, the spot is 2.5 m in front).
const GOAL = { x: SITES.training.x + 2.5, z: SITES.training.z + ((TRAINING_FIELDS.length - 1) / 2) * 7 }
const LANE = { x: 0, z: ARENA.maxZ - 4 }

// Where the UI arrow points on each step: [selector, side of the element it sits on].
const UI_TARGETS = {
  0: ['.kick', 'top'],
  4: ['.kick', 'top'],
  6: ['.wlmodal.show .wlspin', 'top'],
  7: ['.wlmodal.show .wlx', 'top'],
}

export function createTutorial(scene, hud) {
  // --- Banner ----------------------------------------------------------------
  const banner = document.createElement('div')
  banner.className = 'tut-banner'
  banner.innerHTML = '<div class="tutorial" hidden><div class="tut-tag"></div><div class="tut-text"></div><div class="tut-sub"></div></div>'
  document.body.appendChild(banner)
  const box = banner.firstChild
  const tag = box.querySelector('.tut-tag')
  const text = box.querySelector('.tut-text')
  const sub = box.querySelector('.tut-sub')
  let shownKey = ''
  function paintBanner(key, t, s, complete = false) {
    if (key === shownKey) return
    const fresh = key.split('|')[0] !== shownKey.split('|')[0]
    shownKey = key
    box.hidden = !t
    box.classList.toggle('complete', complete)
    tag.textContent = complete ? 'DONE' : 'TUTORIAL'
    text.textContent = t ?? ''
    sub.textContent = s ?? ''
    sub.hidden = !s
    if (fresh) {
      box.style.animation = 'none'
      void box.offsetWidth // restart the pop-in
      box.style.animation = ''
    }
  }

  // --- UI arrow --------------------------------------------------------------
  const arrow = document.createElement('div')
  arrow.className = 'tut-arrow'
  arrow.innerHTML = '<svg viewBox="0 0 60 80"><path d="M18 4h24v34h14L30 76 4 38h14z" fill="#ffd23a" stroke="#121212" stroke-width="6" stroke-linejoin="round"/></svg>'
  arrow.hidden = true
  document.body.appendChild(arrow)
  let hl = null // the element currently glowing
  function clearUi() {
    arrow.hidden = true
    hl?.classList.remove('tut-hl')
    hl = null
  }
  function pointAt(selector, side) {
    const el = document.querySelector(selector)
    const r = el?.getBoundingClientRect()
    if (!el || !r || r.width === 0 || r.height === 0 || document.getElementById('hud')?.classList.contains('ball-air')) return clearUi() // not on screen
    if (hl !== el) {
      hl?.classList.remove('tut-hl')
      el.classList.add('tut-hl')
      hl = el
    }
    arrow.hidden = false
    arrow.dataset.side = side
    arrow.style.left = `${side === 'left' ? r.left - 6 : r.left + r.width / 2}px`
    arrow.style.top = `${side === 'left' ? r.top + r.height / 2 : r.top - 6}px`
  }

  // --- 3D guide --------------------------------------------------------------
  const shape = new Shape()
  shape.moveTo(0, 0.42)
  shape.lineTo(0.34, -0.2)
  shape.lineTo(0, -0.05)
  shape.lineTo(-0.34, -0.2)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 })
  geometry.center()
  // Drawn over everything so walls and landmarks never hide the way.
  const trailMat = new MeshStandardMaterial({ color: '#eef1f6', roughness: 0.5, depthTest: false, transparent: true })
  const beaconMat = new MeshStandardMaterial({ color: '#ffd23a', emissive: '#ff9a1f', emissiveIntensity: 0.6, roughness: 0.4, fog: false, depthTest: false, transparent: true })
  const guide = new Group()
  const trail = new InstancedMesh(geometry, trailMat, MAX_ARROWS)
  trail.frustumCulled = false
  trail.renderOrder = 20
  trail.count = 0
  const beacon = new Mesh(geometry, beaconMat)
  beacon.scale.setScalar(3.2)
  beacon.frustumCulled = false
  beacon.renderOrder = 21
  beacon.visible = false
  guide.add(trail, beacon)
  scene.add(guide)
  const dummy = new Object3D()

  // The 3D target for a step, or null (steps that point at a button instead).
  const target = (step) => (step === 1 ? GOAL : step === 3 ? LANE : step === 5 ? SITES.wheel : step === 8 ? SITES.upgrades : null)

  function drawGuide(step, t) {
    trail.count = 0
    beacon.visible = false
    const to = target(step)
    if (!to) return
    const dx = to.x - player.position.x
    const dz = to.z - player.position.z
    const dist = Math.hypot(dx, dz)
    const ux = dx / (dist || 1)
    const uz = dz / (dist || 1)
    const heading = Math.atan2(ux, uz)
    const phase = (t * SPEED) % SPACING
    let n = 0
    if (dist > HIDE_WITHIN) {
      for (let d = 1.4 + phase; d < dist - 0.6 && n < MAX_ARROWS; d += SPACING) {
        const x = player.position.x + ux * d
        const z = player.position.z + uz * d
        dummy.position.set(x, floorAt(x, z) + 0.3, z)
        dummy.rotation.set(Math.PI / 2 - 0.35, heading, 0, 'YXZ') // lie flat, tip toward the target
        dummy.updateMatrix()
        trail.setMatrixAt(n++, dummy.matrix)
      }
    }
    trail.count = n
    trail.instanceMatrix.needsUpdate = true
    beacon.visible = true
    beacon.position.set(to.x, floorAt(to.x, to.z) + BEACON_HEIGHT + Math.sin(t * 4) * 0.35, to.z)
    beacon.rotation.set(0, t * 2, Math.PI, 'YXZ') // point down, spin about the vertical
  }

  // --- Progress counters (events, not polled) ----------------------------------
  let kicks = 0
  let spun = false
  onStats((what) => {
    const step = stats.tutorialStep
    if (step >= TUTORIAL.steps) return
    if ((step === 0 || step === 2) && (what === 'power' || what === 'level')) kicks++
    if (what === 'spins' && (step === 5 || step === 6)) spun = true
  })

  // --- Per frame -------------------------------------------------------------
  let prev = stats.tutorialStep
  let completeUntil = 0
  function update(t, inLane) {
    if (DISABLE_TUTORIAL || !stats.tutorialReady) return
    const step = stats.tutorialStep
    if (prev < TUTORIAL.steps && step >= TUTORIAL.steps) completeUntil = performance.now() + TUTORIAL.completeMs
    prev = step

    if (step >= TUTORIAL.steps) {
      drawGuide(-1, t)
      clearUi()
      if (performance.now() < completeUntil) paintBanner('done', 'Tutorial Complete!', 'Now go kick for big Wins', true)
      else paintBanner('', null)
      return
    }

    const next = nextStep(step, {
      level: stats.level,
      levelGoal: TUTORIAL.level,
      kicks,
      padKicks: TUTORIAL.padKicks,
      onGoal: !!stats.field,
      inLane,
      kicked: stats.wins > 0 || stats.bestDistance > 0,
      spins: stats.spins,
      wheelOpen: !!document.querySelector('.wlmodal.show'),
      spun,
      windowOpen: hud.windowOpen(),
      nearHill: Math.hypot(player.position.x - SITES.upgrades.x, player.position.z - SITES.upgrades.z) < TUTORIAL.nearRadius,
      done: TUTORIAL.steps,
    })
    if (next !== step) {
      if (next === 5) spun = false
      if (next === 2) kicks = 0
      setTutorialStep(next) // saved by net.js
      return
    }

    drawGuide(step, t)
    const ui = UI_TARGETS[step]
    if (ui) pointAt(...ui)
    else clearUi()

    const press = isTouch ? 'tap' : 'click'
    const [title, hint] = [
      [`${press[0].toUpperCase()}${press.slice(1)} the screen to gain Kick Power (${Math.floor(stats.kickPower)}/${levelCap()})`, `Fill the bar to level up${isTouch ? '' : ' - KICK! or F works too'}`],
      ['Walk onto the x1 Kick goal', 'Follow the arrows'],
      [`Let the goal kick for you (${Math.min(kicks, TUTORIAL.padKicks)}/${TUTORIAL.padKicks})`, 'Stay on the goal - it kicks every few seconds'],
      ['Head to the Kick Lane', 'Follow the arrows to the south end of the arena'],
      ['Kick the ball down the lane!', `Press KICK!, then ${press} again to stop the meter near the top`],
      ['Visit the Lucky Wheel', 'Walk onto the glowing pad'],
      ['Press SPIN!', 'Your first spin is free'],
      ['Close the window', ''],
      ['Upgrade your football!', 'Walk up the hill and spend Wins on better balls'],
    ][step]
    paintBanner(`${step}|${title}|${hint}`, title, hint)
  }

  return { update }
}
