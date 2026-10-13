import { Group, Mesh, SphereGeometry } from 'three'
import { ballMaterial } from './materials.js'
import { BALLS, JUGGLE, KICKBALL } from './config.js'
import { stats } from './stats.js'
import * as bloxity from './bloxity.js'
import { player } from './player.js'
import { inputState } from './input.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'

// The player's visual: always the game's own character (player.glb, or the
// procedural fallback). A signed-in player's equipped Bloxity cosmetics are
// attached and the customizer's body proportions applied; it rebuilds on
// customizer edits and sign-in/out. Everything degrades to the fallback when
// the SDK is blocked.
export function createPlayerAvatar(scene) {
  const group = new Group()
  scene.add(group)

  let avatar = null
  let animator = null
  let generation = 0
  let loaded = false
  let onLoaded = () => {}

  function setAvatar(next) {
    if (avatar) group.remove(avatar)
    disposeAnimator(animator)
    avatar = next
    group.add(avatar)
    animator = makeAnimator(avatar, { holdsBall: true })
  }

  // The ball the player cradles in both hands (the arms are posed by the animator).
  const heldBall = new Mesh(new SphereGeometry(1, 24, 16), ballMaterial('#1b1b20', '#34343c'))
  heldBall.scale.setScalar(0.3)
  heldBall.castShadow = true
  group.add(heldBall)
  const J = JUGGLE
  let shownBall = -1

  // Juggle sequence: release -> right foot -> left foot -> catch. Clicks while one
  // is playing are ignored (the kick itself still scores in hud.doKick).
  //   stage 0 hands open, ball still held   stage 1 ball falling to the right foot
  //   stage 2 ball up, falling to the left  stage 3 ball up, falling into the hands
  let seq = null
  const ball = { y: J.holdY, vy: 0 }

  // Seconds until a ball at (y, vy) next reaches `level` while moving down (Infinity if never).
  function timeToLevel(level) {
    const a = -0.5 * J.gravity
    const c = ball.y - level
    const disc = ball.vy * ball.vy - 4 * a * c
    if (disc < 0) return Infinity
    return (-ball.vy - Math.sqrt(disc)) / (2 * a)
  }

  function startJuggle() {
    if (seq) return false
    seq = { stage: 0, t: 0, swing: null }
    ball.y = J.holdY
    ball.vy = 0
    return true
  }

  function stepJuggle(dt) {
    seq.t += dt
    if (seq.stage === 0) {
      if (seq.t >= J.releaseDelay) seq.stage = 1
    } else {
      ball.vy -= J.gravity * dt
      ball.y += ball.vy * dt
    }

    if (seq.swing) {
      seq.swing.t += dt
      if (!seq.swing.hit && seq.swing.t >= J.contactTime) {
        seq.swing.hit = true
        ball.y = J.kneeY
        ball.vy = Math.sqrt(2 * J.gravity * (J.apex[seq.stage - 1] - J.kneeY))
        seq.stage++
      }
      if (seq.swing.t >= J.swingDuration) seq.swing = null
    } else if ((seq.stage === 1 || seq.stage === 2) && ball.vy < 0 && timeToLevel(J.kneeY) <= J.contactTime) {
      seq.swing = { leg: seq.stage === 1 ? 'R' : 'L', t: 0, hit: false }
    }

    // Catch: ball falling back to hand height in the last stage.
    if (seq.stage === 3 && ball.vy < 0 && ball.y <= J.holdY) {
      ball.y = J.holdY
      ball.vy = 0
      if (!seq.swing) seq = null
      else seq.stage = 4 // let the kicking leg finish its recovery first
    }
    if (seq?.stage === 4 && !seq.swing) seq = null
  }

  // Lane kick: one leg swing; `onContact` fires when the foot meets the ball.
  let strike = null
  let ballHidden = false
  let kickReady = false
  let groundW = 0 // 0 ball in the hands .. 1 ball on the ground at the foot
  const lerp = (a, b, t) => a + (b - a) * t
  function kickSwing(onContact, leg = 'R') {
    if (strike) return false
    strike = { leg, t: 0, hit: false, onContact, ready: (animator?.readyW ?? 0) > 0.5 }
    return true
  }

  setAvatar(buildDefaultCharacter()) // visible immediately; replaced once the rig loads

  async function load() {
    // The SDK fires twice per change (optimistic + confirmed); only the newest load may land.
    const mine = ++generation
    try {
      const next = await loadBaseCharacter()
      if (mine !== generation) return
      const equipped = bloxity.authState.user ? bloxity.getEquippedAvatar() : null
      await attachEquippedAccessories(next, equipped, { skinTextureUrl: bloxity.getSkinTextureUrl() })
      if (mine !== generation) return
      applyProportions(next, bloxity.getProportions())
      setAvatar(next)
    } finally {
      if (mine === generation && !loaded) {
        loaded = true
        onLoaded()
      }
    }
  }

  let signedIn = null
  bloxity.subscribeAuth((s) => {
    const now = !!s.user
    if (now !== signedIn) {
      signedIn = now
      load() // also runs once at start to swap in the real rig
    }
  })
  bloxity.onAvatarChanged(load)
  bloxity.onProportionsChanged(() => applyProportions(avatar, bloxity.getProportions()))

  return {
    group,
    whenLoaded: (fn) => (loaded ? fn() : (onLoaded = fn)),
    juggle: startJuggle,
    kickSwing,
    setKickReady: (on) => (kickReady = on),
    setBallHeld: (held) => (ballHidden = !held),
    update(dt) {
      group.position.set(player.position.x, player.position.y, player.position.z)
      group.rotation.y = player.facing // player.js turns the heading at a fixed rate
      if (stats.equipped !== shownBall) {
        shownBall = stats.equipped // the ball in hand is the equipped football
        const def = BALLS[shownBall] ?? BALLS[0]
        heldBall.material = ballMaterial(def.color, def.patch)
      }
      if (seq) stepJuggle(dt)
      if (strike) {
        strike.t += dt
        if (!strike.hit && strike.t >= J.contactTime) {
          strike.hit = true
          strike.onContact()
        }
        if (strike.t >= J.swingDuration) strike = null
      }
      if (animator) {
        // Hands stay open from the release until the ball drops back to catching height.
        animator.armsOpen = !!seq && (seq.stage < 3 || ball.y > 1.45 || ball.vy > 0)
        animator.kickReady = kickReady
        animator.legSwing = strike ?? seq?.swing ?? null
      }
      animator?.update(dt, {
        grounded: player.grounded,
        speed: Math.hypot(player.velocity.x, player.velocity.z),
        verticalVelocity: player.velocity.y,
        turn: inputState.move.x,
      })
      const free = seq && seq.stage > 0 && seq.stage < 4
      // Kick-ready (Tap to Kick bar up): the ball drops from the hands to the ground in
      // front of the kicking foot, where the lane kick launches it from.
      groundW += ((kickReady || strike ? 1 : 0) - groundW) * (1 - Math.exp(-12 * dt))
      if (strike?.hit) groundW = 0
      const g = groundW
      heldBall.position.set(
        -0.1 * g,
        free ? ball.y : lerp(J.holdY + (avatar?.position.y ?? 0), KICKBALL.radius, g),
        lerp(J.holdZ, KICKBALL.startForward, g),
      )
      heldBall.visible = !ballHidden
      if (free) heldBall.rotation.x -= dt * 6 // tumbles in the air
      else heldBall.rotation.x = 0
    },
  }
}
