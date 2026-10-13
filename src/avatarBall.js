import { Mesh, SphereGeometry } from 'three'
import { ballMaterial } from './materials.js'
import { BALLS, JUGGLE, KICKBALL } from './config.js'

// The football a character cradles in both hands, plus the animations that drive it: the juggle
// sequence, the lane/pad kick swing and the kick-ready stance. Shared by the local player
// (playerAvatar.js) and the other players (remotePlayers.js), which replay it from the `pose`
// string that `poseString()` produces and `applyPose()` consumes.
//   `animator` / `avatarY` are getters because the rig is swapped when the avatar reloads.
export function createAvatarBall(group, { animator, avatarY }) {
  const J = JUGGLE
  const heldBall = new Mesh(new SphereGeometry(1, 24, 16), ballMaterial('#1b1b20', '#34343c'))
  heldBall.scale.setScalar(0.3)
  heldBall.castShadow = true
  group.add(heldBall)
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

  // Counters of started juggles / kicks (and the last kick's leg): relayed so others can replay them.
  let juggles = 0
  let kicks = 0
  let kickLeg = 'R'

  function juggle() {
    if (seq) return false
    seq = { stage: 0, t: 0, swing: null }
    ball.y = J.holdY
    ball.vy = 0
    juggles = (juggles + 1) % 1000
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
    strike = { leg, t: 0, hit: false, onContact, ready: (animator()?.readyW ?? 0) > 0.5 }
    kicks = (kicks + 1) % 1000
    kickLeg = leg
    return true
  }

  function setBall(index) {
    if (index === shownBall) return
    shownBall = index // the ball in hand is the equipped football
    const def = BALLS[index] ?? BALLS[0]
    heldBall.material = ballMaterial(def.color, def.patch)
  }

  // "r1h0k12Rj3": kick-ready, ball hidden, kicks started (+ leg), juggles started. <= 32 chars.
  function poseString() {
    return `r${kickReady ? 1 : 0}h${ballHidden ? 1 : 0}k${kicks}${kickLeg}j${juggles}`
  }

  // Replays a remote player's pose string. Counters seen first time are adopted without playing,
  // so joining mid-session doesn't trigger a stale kick.
  let seen = null
  function applyPose(pose) {
    const m = /^r([01])h([01])k(\d+)([LR])j(\d+)$/.exec(pose || '')
    if (!m) {
      kickReady = false
      return
    }
    kickReady = m[1] === '1'
    ballHidden = m[2] === '1'
    const k = +m[3]
    const j = +m[5]
    if (seen) {
      if (k !== seen.k) kickSwing(() => {}, m[4])
      if (j !== seen.j) juggle()
    }
    seen = { k, j }
  }

  function update(dt) {
    const a = animator()
    if (seq) stepJuggle(dt)
    if (strike) {
      strike.t += dt
      if (!strike.hit && strike.t >= J.contactTime) {
        strike.hit = true
        strike.onContact()
      }
      if (strike.t >= J.swingDuration) strike = null
    }
    if (a) {
      // Hands stay open from the release until the ball drops back to catching height.
      a.armsOpen = !!seq && (seq.stage < 3 || ball.y > 1.45 || ball.vy > 0)
      a.kickReady = kickReady
      a.legSwing = strike ?? seq?.swing ?? null
    }
  }

  // Positions the ball; call after the animator has updated.
  function place(dt) {
    const free = seq && seq.stage > 0 && seq.stage < 4
    // Kick-ready (Tap to Kick bar up): the ball drops from the hands to the ground in
    // front of the kicking foot, where the lane kick launches it from.
    groundW += ((kickReady || strike ? 1 : 0) - groundW) * (1 - Math.exp(-12 * dt))
    if (strike?.hit) groundW = 0
    const g = groundW
    heldBall.position.set(
      -0.1 * g,
      free ? ball.y : lerp(J.holdY + avatarY(), KICKBALL.radius, g),
      lerp(J.holdZ, KICKBALL.startForward, g),
    )
    heldBall.visible = !ballHidden
    if (free) heldBall.rotation.x -= dt * 6 // tumbles in the air
    else heldBall.rotation.x = 0
  }

  return {
    juggle,
    kickSwing,
    setBall,
    setKickReady: (on) => (kickReady = on),
    setBallHeld: (held) => (ballHidden = !held),
    poseString,
    applyPose,
    update,
    place,
    dispose() {
      group.remove(heldBall)
      heldBall.geometry.dispose()
    },
  }
}
