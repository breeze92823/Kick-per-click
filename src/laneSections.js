// Name signs above each lane gate (the gate geometry itself is built in arena.js): the zone you
// are entering and how far down the lane it starts, matching the HUD zone bar.
import { ARENA, BEACH, GROUND_Y, LANE, ZONES } from './config.js'
import { makeLabel } from './labels.js'
import { sectionStart } from './arena.js'

export function createLaneSections(scene) {
  for (let i = 1; i <= LANE.sections; i++) {
    const finish = i === LANE.sections
    const [name, color] = ZONES[Math.min(i, ZONES.length - 1)]
    const lines = finish
      ? [{ text: 'FINISH', px: 90, fill: color }, { text: `${LANE.length}m`, px: 56 }]
      : [{ text: name, px: 90, fill: color }, { text: `${i * LANE.sectionLength}m`, px: 56 }]
    for (const cx of [0, BEACH.cx]) { // hub lane and beach lane
      const label = makeLabel(lines, { scale: 0.045 })
      label.position.set(cx + (ARENA.lane.minX + ARENA.lane.maxX) / 2, GROUND_Y - ARENA.lane.drop + 14, sectionStart(i))
      scene.add(label)
    }
  }
  // Beach lane mouth: the 2X wins banner.
  const banner = makeLabel([{ text: 'BEACH LANE', px: 90, fill: 'cyan' }, { text: `${BEACH.winsMult}X WINS`, px: 64, fill: 'gold' }], { scale: 0.045 })
  banner.position.set(BEACH.cx, GROUND_Y + 14, ARENA.maxZ - 6)
  scene.add(banner)
}
