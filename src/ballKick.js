// The lane kick: KICK! in the kick zone swings the leg and launches a football down
// the lane on a gravity arc. It lands and stops (no bounce), the distance pops up,
// then the ball and the camera reset to the pre-kick state.
import { Mesh, SphereGeometry } from 'three'
import { ARENA, BALLS, KICKBALL as K } from './config.js'
import { ballMaterial } from './materials.js'
import { floorAt, player } from './player.js'
import { setKickView, setTrackTarget } from './camera.js'
import { kickSpeed, stats } from './stats.js'

const WALL_MARGIN = 0.6 // m the ball keeps from the lane walls

export function createBallKick(scene, avatar, onLanded) {
  const mesh = new Mesh(new SphereGeometry(1, 24, 16), ballMaterial('#f4f4f4', '#1d1d22'))
  mesh.scale.setScalar(K.radius)
  mesh.castShadow = true
  mesh.visible = false
  scene.add(mesh)

  let state = 'idle' // idle | swinging | flying | landed
  let startZ = 0
  let timer = 0
  let power = 1 // 0..1 from the aim meter
  const vel = { x: 0, y: 0, z: 0 }

  function launch() {
    const def = BALLS[stats.equipped] ?? BALLS[0]
    mesh.material = ballMaterial(def.color, def.patch)
    const speed = kickSpeed() * (0.5 + 0.5 * power)
    const a = (K.angle * Math.PI) / 180
    vel.x = 0
    vel.y = Math.sin(a) * speed
    vel.z = Math.cos(a) * speed
    mesh.position.set(player.position.x, player.position.y + K.startHeight, player.position.z + K.startForward)
    startZ = mesh.position.z
    mesh.visible = true
    state = 'flying'
    setTrackTarget(mesh.position)
  }

  function fly(dt) {
    const p = mesh.position
    const prevZ = p.z
    vel.y -= K.gravity * dt
    p.x += vel.x * dt
    p.y += vel.y * dt
    p.z += vel.z * dt
    mesh.rotation.x += (vel.z / K.radius) * dt

    // Lane walls and end: the ball stops going forward instead of leaving the lane.
    const { maxZ, lane } = ARENA
    const inner = lane.maxX - WALL_MARGIN
    if (prevZ < maxZ && p.z >= maxZ - K.radius && Math.abs(p.x) > inner) {
      p.z = prevZ
      vel.z = 0
    }
    if (p.z >= maxZ) p.x = Math.max(-inner, Math.min(inner, p.x))
    if (p.z > lane.endZ - 1) {
      p.z = lane.endZ - 1
      vel.z = 0
    }

    const floor = floorAt(p.x, p.z, p.y)
    if (vel.y < 0 && p.y - K.radius <= floor) {
      p.y = floor + K.radius
      state = 'landed'
      timer = K.landHold
      setTrackTarget(null) // camera eases back at once; the ball resets after landHold
      onLanded?.(Math.max(0, p.z - startZ))
    }
  }

  return {
    get busy() {
      return state !== 'idle'
    },
    // Starts the kick if no ball is in play. Returns whether it did.
    kick(p = 1) {
      if (state !== 'idle') return false
      power = p
      player.facing = 0 // face down the lane (+Z)
      setKickView()
      state = 'swinging'
      avatar.kickSwing(() => {
        avatar.setBallHeld(false)
        launch()
      })
      return true
    },
    update(dt) {
      if (state === 'flying') {
        // Two substeps: a fast ball moves over a metre per frame.
        fly(dt / 2)
        if (state === 'flying') fly(dt / 2)
      } else if (state === 'landed') {
        timer -= dt
        if (timer <= 0) {
          mesh.visible = false
          avatar.setBallHeld(true)
          state = 'idle'
        }
      }
    },
  }
}
