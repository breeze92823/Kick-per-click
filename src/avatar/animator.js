// Procedural locomotion animator, ported from +1 Cut Grass Adventure's
// PlayerAnimator + LocomotionCycle. States idle / run / airborne / landing are
// blended through pose buffers; the walk and run are ONE cycle at two depths,
// its phase advancing with distance travelled so the feet stay planted at any
// speed. Writes only to bones and the avatar root's rotation / position.y (the
// player group owns world placement).
import { ANIM } from '../config.js'
import { BONE_INDEX, PlayerRig, PoseBuffer } from './rig.js'

const TAU = Math.PI * 2
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a, b, t) => a + (b - a) * t
const ease = (t) => t * t * (3 - 2 * t)
const smoothstep = (e0, e1, v) => ease(clamp((v - e0) / (e1 - e0 || 1), 0, 1))
const kneeCurve = (phase) => {
  const raw = Math.sin(phase - Math.PI / 2.6)
  return raw > 0 ? raw * raw : 0
}

const L = ANIM.locomotion

// Kick swing keyframes: [time s, hip pitch, knee bend]. +hip swings the thigh back.
// Ball contact lands at JUGGLE.contactTime (config.js), right after the strike keyframe.
const SWING = [
  [0, 0, 0],
  [0.1, 0.55, 1.1],
  [0.16, -1.15, 0.15],
  [0.28, -1.3, 0.3],
  [0.42, 0, 0],
]
function legSwingPose(t) {
  if (t <= 0) return [0, 0]
  for (let i = 1; i < SWING.length; i++) {
    const [t1, h1, k1] = SWING[i]
    if (t <= t1) {
      const [t0, h0, k0] = SWING[i - 1]
      const e = ease((t - t0) / (t1 - t0))
      return [lerp(h0, h1, e), lerp(k0, k1, e)]
    }
  }
  return [0, 0]
}

export function makeAnimator(root, { holdsBall = false } = {}) {
  if (!root) return null
  const animator = new PlayerAnimator(root)
  animator.holdsBall = holdsBall
  return animator
}

export function disposeAnimator(animator) {
  animator?.dispose()
}

class PlayerAnimator {
  constructor(root) {
    this.root = root
    this.rig = new PlayerRig(root)
    this.target = new PoseBuffer()
    this.from = new PoseBuffer()
    this.output = new PoseBuffer()
    this.scratch = new PoseBuffer()
    this.state = 'idle'
    this.stateTime = 0
    this.blendTime = 0
    this.blendDuration = 0
    this.phase = 0
    this.idleTime = 0
    this.airTime = 0
    this.bank = 0
  }

  dispose() {
    this.rig.resetToBindPose()
    this.root.rotation.set(0, 0, 0)
    this.root.position.y = 0
  }

  // input: { grounded, speed, verticalVelocity, turn (-1..1) }
  update(dt, input) {
    if (!(dt > 0)) return
    this.stateTime += dt
    this.resolveState(dt, input)
    this.writePose(dt, input)
    this.blend(dt)
    if (this.holdsBall) {
      this.saved ||= new PoseBuffer()
      this.saved.copyFrom(this.output) // keep blend state free of the hold override
      this.holdBall(dt)
      this.rig.applyPose(this.output)
      this.output.copyFrom(this.saved)
      this.applyVisual(dt, input)
      return
    }
    this.rig.applyPose(this.output)
    this.applyVisual(dt, input)
  }

  resolveState(dt, input) {
    if (!input.grounded) {
      // Ignore the few frames of a step down a ledge; only a real drop is airborne.
      this.airTime += dt
      if (this.airTime > ANIM.airborneDelay) this.setState('airborne', ANIM.transitions.toAirborne)
      return
    }
    this.airTime = 0
    if (this.state === 'airborne') {
      this.setState('landing', ANIM.transitions.toLanding)
      return
    }
    if (this.state === 'landing' && this.stateTime < ANIM.landing.duration) return
    this.setState(input.speed < L.idleSpeed ? 'idle' : 'run', ANIM.transitions.toLocomotion)
  }

  setState(next, duration) {
    if (next === this.state) return
    this.from.copyFrom(this.output)
    this.state = next
    this.stateTime = 0
    this.blendTime = 0
    this.blendDuration = duration
  }

  writePose(dt, input) {
    const t = this.target
    switch (this.state) {
      case 'idle': {
        // Ease the stride back to a neutral standing phase.
        const goal = this.phase > Math.PI ? TAU : 0
        this.phase += (goal - this.phase) * (1 - Math.exp(-8 * dt))
        if (this.phase >= TAU - 1e-4) this.phase = 0
        this.idleTime += dt
        const breath = Math.sin(this.idleTime * ANIM.idle.breathFrequency * TAU)
        t.applyDefinition(ANIM.idle.basePose)
        t.add('Spine1', breath * ANIM.idle.breathAmount)
        t.add('Neck1', -breath * ANIM.idle.breathAmount * 0.6)
        t.bobY = breath * ANIM.idle.breathBob
        break
      }
      case 'run': {
        const frequency = clamp(input.speed / L.strideDistance, L.minFrequency, L.maxFrequency)
        this.phase = (this.phase + frequency * TAU * dt) % TAU
        this.writeLocomotion(t, input.speed)
        break
      }
      case 'airborne': {
        const rising = clamp(input.verticalVelocity / ANIM.airborne.velocityReference, -1, 1)
        t.applyDefinition(ANIM.airborne.fall)
        this.scratch.applyDefinition(ANIM.airborne.rise)
        t.lerpBetween(t, this.scratch, clamp(0.5 + rising * 0.5, 0, 1))
        t.bobY = 0
        break
      }
      case 'landing': {
        const depth = 1 - ease(clamp(this.stateTime / ANIM.landing.duration, 0, 1))
        t.applyDefinition(ANIM.landing.pose, depth)
        t.bobY = ANIM.landing.bobY * depth
        break
      }
    }
  }

  // One cycle at two depths (walk -> run), derived from actual speed.
  writeLocomotion(out, speed) {
    const run = smoothstep(L.walkSpeed, L.runSpeed, speed)
    const sprint = smoothstep(L.runSpeed, L.sprintSpeed, speed) * 0.4
    const depth = (d) => lerp(lerp(d.walk, d.run, run), d.sprint, sprint)
    const phase = this.phase
    const swing = Math.sin(phase)
    const opposite = -swing
    const hip = depth(L.hipSwing)
    const knee = depth(L.kneeBend)
    const arm = depth(L.armSwing)
    const elbow = depth(L.elbowBend)
    const twist = depth(L.torsoTwist)
    const lean = depth(L.torsoLean)
    const headTwist = depth(L.headCounterTwist)
    const roll = depth(L.torsoRoll)
    const bob = depth(L.bob)

    out.reset()
    // Thighs half a cycle apart; the stride is pushed back more than forward at speed.
    const back = 1 + sprint * 0.35
    out.set('LegL1', hip * (swing > 0 ? swing : swing * back))
    out.set('LegR1', hip * (opposite > 0 ? opposite : opposite * back))
    out.set('LegL2', knee * kneeCurve(phase))
    out.set('LegR2', knee * kneeCurve(phase + Math.PI))
    // Arms counter-swing against the leg on the same side.
    out.set('ArmL1', arm * opposite - sprint * 0.25, 0, sprint * 0.12)
    out.set('ArmR1', arm * swing - sprint * 0.25, 0, -sprint * 0.12)
    out.set('ArmL2', elbow + elbow * 0.35 * Math.max(0, opposite))
    out.set('ArmR2', elbow + elbow * 0.35 * Math.max(0, swing))
    // Torso leans in, twists with the stride and rolls on the footfall.
    out.set('Spine1', lean, twist * opposite, roll * Math.sin(phase * 2))
    out.set('Spine2', lean * 0.4, twist * 0.5 * opposite, 0)
    out.set('Neck1', -lean * 0.7, headTwist * swing, 0)
    out.bobY = -bob * Math.cos(phase * 2)
  }

  blend(dt) {
    if (this.blendDuration > 0) {
      this.blendTime += dt
      const t = clamp(this.blendTime / this.blendDuration, 0, 1)
      this.output.lerpBetween(this.from, this.target, ease(t))
      if (t >= 1) this.blendDuration = 0
    } else {
      this.output.copyFrom(this.target)
    }
  }

  // Arms cradle the ball in front of the chest, overriding the locomotion arms
  // (legs and torso keep animating). Skipped while airborne for a natural jump.
  holdBall(dt) {
    // `armsOpen` (set by the juggle sequence): 1 = hands released and spread for balance.
    const want = this.state === 'airborne' ? 0.35 : this.armsOpen ? 0.7 : 1
    this.holdWeight = (this.holdWeight ?? 0) + (want - (this.holdWeight ?? 0)) * (1 - Math.exp(-14 * dt))
    this.open = (this.open ?? 0) + ((this.armsOpen ? 1 : 0) - (this.open ?? 0)) * (1 - Math.exp(-12 * dt))
    const w = this.holdWeight
    const k = this.open
    const o = this.output.rotations
    const mix = (bone, hx, hz, ox, oz, hy = 0) => {
      const at = BONE_INDEX[bone] * 3
      o[at] = lerp(o[at], lerp(hx, ox, k), w)
      o[at + 1] = lerp(o[at + 1], hy, w)
      o[at + 2] = lerp(o[at + 2], lerp(hz, oz, k), w)
    }
    mix('ArmL1', -0.95, -0.42, -0.35, 0.75)
    mix('ArmR1', -0.95, 0.42, -0.35, -0.75)
    mix('ArmL2', 0.7, 0, 0.3, 0)
    mix('ArmR2', 0.7, 0, 0.3, 0)

    // Kicking leg (set by the juggle sequence): wind-up back, strike forward, recover.
    const sw = this.legSwing
    if (sw) {
      const [hip, knee] = legSwingPose(sw.t)
      const side = sw.leg === 'R' ? 'R' : 'L'
      const set = (bone, v) => {
        o[BONE_INDEX[bone] * 3] = v
        o[BONE_INDEX[bone] * 3 + 1] = 0
        o[BONE_INDEX[bone] * 3 + 2] = 0
      }
      set(`Leg${side}1`, hip)
      set(`Leg${side}2`, knee)
      // Plant the other leg with a soft knee.
      const other = side === 'R' ? 'L' : 'R'
      const at = BONE_INDEX[`Leg${other}1`] * 3
      o[at] = lerp(o[at], 0.1, 0.85)
      o[BONE_INDEX[`Leg${other}2`] * 3] = 0.25
    }
  }

  applyVisual(dt, input) {
    const wantBank = this.state === 'run' ? -input.turn * L.bankAngle * 0.6 : 0
    this.bank += (wantBank - this.bank) * (1 - Math.exp(-L.bankRate * dt))
    this.root.rotation.set(0, 0, this.bank)
    this.root.position.y = this.output.bobY
  }
}
