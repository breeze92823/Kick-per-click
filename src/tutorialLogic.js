// The tutorial's step machine, free of game imports so it can be unit-tested (tutorial.js feeds it the live
// numbers each frame). Steps: 0 click the screen until Kick Power fills and you level up, 1 walk onto the x1
// training goal, 2 let the goal kick a few times, 3 walk to the kick lane, 4 take a kick down the lane, 5 walk to the Lucky Wheel, 6 press SPIN,
// 7 close the wheel, 8 walk up the upgrade hill, `done` = finished.
//
// c = { level, levelGoal, kicks, padKicks, onGoal, inLane, kicked, spins, wheelOpen, spun, windowOpen, nearHill, done }
// Returns the step to be on now (it may go back, e.g. when the player leaves the goal).
export function nextStep(step, c) {
  if (step >= c.done) return step
  switch (step) {
    case 0:
      return c.level >= c.levelGoal ? 1 : 0
    case 1:
      return c.onGoal ? 2 : 1
    case 2:
      if (!c.onGoal) return 1
      return c.kicks >= c.padKicks ? 3 : 2
    case 3:
      return c.inLane ? 4 : 3
    case 4:
      if (c.kicked) return 5
      return c.inLane ? 4 : 3
    case 5:
      if (c.spins < 1) return 8 // nothing to spin: skip the wheel lesson
      return c.wheelOpen ? 6 : 5
    case 6:
      if (c.spun) return 7
      return c.wheelOpen ? 6 : 5
    case 7:
      return c.windowOpen ? 7 : 8
    case 8:
      return c.nearHill ? c.done : 8
    default:
      return step
  }
}
