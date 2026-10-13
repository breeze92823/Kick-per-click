import { Group } from 'three'
import { stats } from './stats.js'
import * as bloxity from './bloxity.js'
import { player } from './player.js'
import { inputState } from './input.js'
import { createAvatarBall } from './avatarBall.js'
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
  const ball = createAvatarBall(group, { animator: () => animator, avatarY: () => avatar?.position.y ?? 0 })

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
    juggle: ball.juggle,
    kickSwing: ball.kickSwing,
    setKickReady: ball.setKickReady,
    setBallHeld: ball.setBallHeld,
    poseString: ball.poseString,
    update(dt) {
      group.position.set(player.position.x, player.position.y, player.position.z)
      group.rotation.y = player.facing // player.js turns the heading at a fixed rate
      ball.setBall(stats.equipped)
      ball.update(dt)
      animator?.update(dt, {
        grounded: player.grounded,
        speed: Math.hypot(player.velocity.x, player.velocity.z),
        verticalVelocity: player.velocity.y,
        turn: inputState.move.x,
      })
      ball.place(dt)
    },
  }
}
