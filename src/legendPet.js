// The equipped legend as a small blocky pet that trails its owner (the local player and every
// remote player). Built from boxes in the legend's colours (same palette as the HUD busts).
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'

const SKIN = 0, HAIR = 1, SHIRT = 2, TRIM = 3
// skin, hair, shirt, trim (sleeves/shorts) -- mirrors LEGEND_ICONS in hud.js
const LOOKS = {
  ronaldu: ['#e8b48a', '#2a1a14', '#c8202c', '#0f6a46'],
  cancello: ['#f2c08a', '#241a16', '#4aa0f0', '#8fd0ff'],
  pogbo: ['#8a5a3a', '#1c1410', '#2a2018', '#d8a840'],
  kvarra: ['#f2c08a', '#8a4a28', '#f4f4f4', '#f4f4f4'],
  neymer: ['#f2c08a', '#3a2a22', '#f4f4f8', '#f4f4f8'],
  vinny: ['#7a4a2a', '#14100c', '#ffd81a', '#b8701a'],
  sallah: ['#c08a5a', '#4a2a1c', '#d82030', '#f2c08a'],
  yamol: ['#c88a5a', '#3a2412', '#2a46b8', '#c42a50'],
  beckhem: ['#f2c08a', '#f0d890', '#d82a2a', '#f2c08a'],
  kruyf: ['#f2c08a', '#5a3a22', '#2a46b8', '#c42a50'],
  debruyn: ['#f2c08a', '#d8a860', '#6ab4f0', '#6ab4f0'],
  haalando: ['#f2c08a', '#e0b070', '#6ab4f0', '#6ab4f0'],
}
const PET_SCALE = 0.6
const FOLLOW = { behind: 1.7, side: 1.5, ease: 6, hop: 0.12 }

const box = (w, h, d) => new BoxGeometry(w, h, d)
const G = {
  head: box(0.8, 0.8, 0.8),
  hair: box(0.86, 0.3, 0.86),
  body: box(0.9, 1, 0.5),
  arm: box(0.28, 0.9, 0.3),
  leg: box(0.34, 0.8, 0.34),
  eye: box(0.12, 0.14, 0.04),
  chilliBody: box(1.1, 1.7, 0.9),
  stem: box(0.22, 0.4, 0.22),
  visor: box(0.9, 0.24, 0.06),
}

const mats = (colors) => colors.map((c) => new MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true }))
const part = (g, m, x, y, z) => {
  const mesh = new Mesh(g, m)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  return mesh
}

function buildPet(id) {
  const root = new Group()
  let m
  if (id === 'chilli') {
    m = mats(['#e5242b', '#2fb52a', '#141420', '#3aa0ff', '#7fc8ff'])
    root.add(part(G.chilliBody, m[0], 0, 1.35, 0))
    root.add(part(G.stem, m[1], 0, 2.4, 0))
    root.add(part(G.visor, m[2], 0, 1.75, 0.46))
    for (const x of [-0.65, 0.65]) root.add(part(G.arm, m[0], x, 1.3, 0))
    for (const x of [-0.25, 0.25]) root.add(part(G.leg, m[3], x, 0.4, 0))
  } else {
    const look = LOOKS[id]
    if (!look) return null
    m = [...mats(look), new MeshStandardMaterial({ color: '#141420' })]
    root.add(part(G.leg, m[TRIM], -0.2, 0.4, 0), part(G.leg, m[TRIM], 0.2, 0.4, 0))
    root.add(part(G.body, m[SHIRT], 0, 1.3, 0))
    root.add(part(G.arm, m[TRIM], -0.6, 1.3, 0), part(G.arm, m[TRIM], 0.6, 1.3, 0))
    root.add(part(G.head, m[SKIN], 0, 2.2, 0))
    root.add(part(G.hair, m[HAIR], 0, 2.55, -0.02))
    root.add(part(G.eye, m[4], -0.18, 2.25, 0.41), part(G.eye, m[4], 0.18, 2.25, 0.41))
  }
  root.scale.setScalar(PET_SCALE)
  return { root, m }
}

export function createLegendPet(scene) {
  const holder = new Group()
  holder.visible = false
  scene.add(holder)
  let id = ''
  let built = null
  let placed = false
  let shown = true
  let t = 0

  function setLegend(next) {
    if (next === id) return
    id = next
    if (built) {
      holder.remove(built.root)
      for (const x of built.m) x.dispose()
      built = null
    }
    built = id ? buildPet(id) : null
    if (built) holder.add(built.root)
    holder.visible = !!built && shown
    placed = false
  }

  function setVisible(on) {
    shown = on
    holder.visible = !!built && on
  }

  // pos: owner feet position, facing: owner heading (radians, 0 = +Z), speed: 0..1 of run speed.
  function update(dt, pos, facing, speed) {
    if (!built) return
    const sin = Math.sin(facing), cos = Math.cos(facing)
    const tx = pos.x - sin * FOLLOW.behind + cos * FOLLOW.side
    const tz = pos.z - cos * FOLLOW.behind - sin * FOLLOW.side
    const k = placed ? 1 - Math.exp(-FOLLOW.ease * dt) : 1
    const dx = tx - holder.position.x, dz = tz - holder.position.z
    holder.position.x += dx * k
    holder.position.z += dz * k
    holder.position.y += (pos.y - holder.position.y) * (placed ? Math.min(1, dt * 12) : 1)
    placed = true
    // Turn toward the owner while idle, toward the way it is moving otherwise.
    const moving = Math.hypot(dx, dz) > 0.05
    const want = moving && speed > 0.05 ? Math.atan2(dx, dz) : facing
    holder.rotation.y += Math.atan2(Math.sin(want - holder.rotation.y), Math.cos(want - holder.rotation.y)) * Math.min(1, dt * 8)
    t += dt * (moving ? 12 : 2.5)
    built.root.position.y = moving ? Math.abs(Math.sin(t)) * FOLLOW.hop * 2 : Math.sin(t) * 0.03 + 0.04
  }

  function dispose() {
    setLegend('')
    scene.remove(holder)
  }

  return { setLegend, setVisible, update, dispose, get id() { return id } }
}
