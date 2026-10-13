// Name signs above each lane gate (the gate geometry itself is built in arena.js): the zone you
// are entering and how far down the lane it starts, matching the HUD zone bar.
import { ARENA, GROUND_Y, LANE, ZONES } from './config.js'
import { makeLabel } from './labels.js'
import { sectionStart } from './arena.js'

export function createLaneSections(scene) {
  for (let i = 1; i <= LANE.sections; i++) {
    const finish = i === LANE.sections
    const [name, color] = ZONES[Math.min(i, ZONES.length - 1)]
    const lines = finish
      ? [{ text: 'FINISH', px: 90, fill: color }, { text: `${LANE.length}m`, px: 56 }]
      : [{ text: name, px: 90, fill: color }, { text: `${i * LANE.sectionLength}m`, px: 56 }]
    const label = makeLabel(lines, { scale: 0.045 })
    label.position.set((ARENA.lane.minX + ARENA.lane.maxX) / 2, GROUND_Y - ARENA.lane.drop + 14, sectionStart(i))
    scene.add(label)
  }
}
