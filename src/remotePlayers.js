// The other players in the room (net.js -> server WorldState.players): each one is the game's
// character with their Bloxity cosmetics and a name tag, eased toward the pose the server last
// relayed. Diffed against the roster every frame, so joins/leaves need no events.
import { Group } from 'three'
import { NET, PHYSICS, inBeach } from './config.js'
import { net } from './net.js'
import { makeLabel } from './labels.js'
import { createLegendPet } from './legendPet.js'
import { createAvatarBall } from './avatarBall.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'

const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

class Remote {
  constructor(parent) {
    this.group = new Group()
    this.group.visible = false
    parent.add(this.group)
    this.avatar = null
    this.animator = null
    this.avatarJson = null // what the current rig was built from
    this.generation = 0
    this.nameText = null
    this.label = null
    this.placed = false
    this.vy = 0
    this.pet = createLegendPet(parent)
    // Held ball + juggle / kick / kick-ready animations, replayed from the relayed `pose` string.
    this.ball = createAvatarBall(this.group, { animator: () => this.animator, avatarY: () => this.avatar?.position.y ?? 0 })
    this.setAvatar(buildDefaultCharacter())
  }

  setAvatar(next) {
    if (this.avatar) this.group.remove(this.avatar)
    disposeAnimator(this.animator)
    this.avatar = next
    this.group.add(next)
    this.animator = makeAnimator(next, { holdsBall: true })
  }

  // A signed-in player's look arrives as JSON { equipped, proportions, skin }; "" = default.
  async syncAvatar(json) {
    if (json === this.avatarJson) return
    this.avatarJson = json
    if (!json) return this.setAvatar(buildDefaultCharacter())
    const mine = ++this.generation
    let look = null
    try {
      look = JSON.parse(json)
    } catch {
      return
    }
    try {
      const group = await loadBaseCharacter()
      if (mine !== this.generation) return
      await attachEquippedAccessories(group, look?.equipped, { skinTextureUrl: look?.skin || undefined })
      if (mine !== this.generation) return
      applyProportions(group, look?.proportions)
      this.setAvatar(group)
    } catch (err) {
      console.warn('[remotePlayers] avatar load failed', err) // keep the default look
    }
  }

  syncName(name) {
    if (name === this.nameText) return
    this.nameText = name
    const lines = [{ text: name, px: 40 }]
    if (!this.label) {
      this.label = makeLabel(lines, { scale: 0.012 })
      this.label.position.y = 3.2
      this.group.add(this.label)
    } else this.label.setLines(lines)
  }

  update(p, dt) {
    this.syncName(p.username || 'Player')
    this.syncAvatar(p.avatar)

    const g = this.group
    const k = this.placed ? 1 - Math.exp(-NET.remoteLerp * dt) : 1
    const prevY = g.position.y
    g.position.x += (p.x - g.position.x) * k
    g.position.y += (p.y - g.position.y) * k
    g.position.z += (p.z - g.position.z) * k
    g.rotation.y += angleDelta(g.rotation.y, p.yaw) * k
    this.vy = this.placed ? this.vy + ((g.position.y - prevY) / dt - this.vy) * Math.min(1, dt * 10) : 0
    this.placed = true

    this.ball.setBall(p.ball)
    this.ball.applyPose(p.pose)
    this.ball.update(dt)
    this.animator?.update(dt, {
      grounded: p.grounded,
      speed: p.speed01 * PHYSICS.moveSpeed,
      verticalVelocity: this.vy,
      turn: 0,
    })
    this.ball.place(dt)
    this.pet.setLegend(p.legend || '')
    this.pet.update(dt, g.position, g.rotation.y, p.speed01)
  }

  dispose(parent) {
    parent.remove(this.group)
    this.pet.dispose()
    this.ball.dispose()
    disposeAnimator(this.animator)
    if (this.label) {
      this.label.material.map?.dispose()
      this.label.material.dispose()
    }
  }
}

export function createRemotePlayers(scene) {
  const root = new Group()
  scene.add(root)
  const remotes = new Map() // sessionId -> Remote

  return {
    update(dt, viewer) {
      const players = net.players
      const mine = net.sessionId
      if (!players || !net.connected) {
        for (const r of remotes.values()) r.dispose(root)
        remotes.clear()
        return
      }
      // Nearest first, capped, so a full room of 50 does not drown the frame rate.
      const near = []
      players.forEach((p, id) => {
        if (id === mine || inBeach(p.x) !== inBeach(viewer.x)) return // players in the other world are not drawn
        near.push({ id, p, d: Math.hypot(p.x - viewer.x, p.z - viewer.z) })
      })
      near.sort((a, b) => a.d - b.d)
      const keep = new Set()
      for (const { id, p, d } of near.slice(0, NET.maxRemotes)) {
        keep.add(id)
        let r = remotes.get(id)
        if (!r) remotes.set(id, (r = new Remote(root)))
        r.group.visible = d < NET.remoteFade
        r.pet.setVisible(r.group.visible)
        if (r.group.visible) r.update(p, dt)
        else {
          r.placed = false // out of range: skip the work, snap into place when it comes back
          r.group.position.set(p.x, p.y, p.z)
        }
      }
      for (const [id, r] of remotes) {
        if (keep.has(id)) continue
        r.dispose(root)
        remotes.delete(id)
      }
    },
  }
}
