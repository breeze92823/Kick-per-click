// The tutorial's step machine, free of game imports so it can be unit-tested (tutorial.js feeds it the live
// numbers each frame). Steps:
//   0 click the screen until Kick Power fills (level 2)   1 walk to the x1 training goal
//   2 train there until level 3                           3 walk to the kick strip
//   4 kick again and again until the +2 Kick ball is affordable
//   5 walk to that ball's pad and buy it                  6 walk back to the x1 goal
//   7 train there until level 4                           8 walk to the kick strip
//   9 take one more kick                                  10 walk to the Lucky Wheel
//   11 press SPIN once                                     12 close the wheel   `done` = finished.
//
// c = { level, level2, level3, level4, onGoal, inLane, canBuy, hasBall, landed, spins, wheelOpen, spun, windowOpen, done }
//   canBuy: wins cover the ball; hasBall: ball owned; landed: a kick paid out since step 9.
// Returns the step to be on now (it may go back, e.g. when the player leaves the goal).
export function nextStep(step, c) {
  if (step >= c.done) return step
  switch (step) {
    case 0:
      return c.level >= c.level2 ? 1 : 0
    case 1:
      if (c.level >= c.level3) return 3
      return c.onGoal ? 2 : 1
    case 2:
      if (c.level >= c.level3) return 3
      return c.onGoal ? 2 : 1
    case 3:
      if (c.hasBall) return 6
      return c.inLane ? 4 : 3
    case 4:
      if (c.hasBall || c.canBuy) return c.hasBall ? 6 : 5
      return c.inLane ? 4 : 3
    case 5:
      if (c.hasBall) return 6
      return c.canBuy ? 5 : 4
    case 6:
      if (c.level >= c.level4) return 8
      return c.onGoal ? 7 : 6
    case 7:
      if (c.level >= c.level4) return 8
      return c.onGoal ? 7 : 6
    case 8:
      return c.inLane ? 9 : 8
    case 9:
      if (c.landed) return 10
      return c.inLane ? 9 : 8
    case 10:
      if (c.spins < 1) return c.done // nothing to spin: skip the wheel lesson
      return c.wheelOpen ? 11 : 10
    case 11:
      if (c.spun) return 12
      return c.wheelOpen ? 11 : 10
    case 12:
      return c.windowOpen ? 12 : c.done
    default:
      return step
  }
}
