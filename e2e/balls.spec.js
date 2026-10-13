import { test, expect } from '@playwright/test'

// Mirrors BALLS / BALL_ROWS in src/config.js ({ cost: total wins to unlock, kick: power per click }).
const BALLS = [
  [0, 1], [10, 2], [30, 3], [140, 5], [500, 7], [1300, 10], [1600, 11], [2000, 12], [2500, 13], [3100, 16],
  [3900, 18], [4900, 21], [6400, 23], [8500, 26], [11000, 30], [15000, 34], [19000, 40], [25000, 44], [34000, 49], [44000, 56],
].map(([cost, kick]) => ({ cost, kick }))
const BALL_ROWS = [6, 6, 8]
const UPGRADES = { x: 30, z: -6 } // SITES.upgrades; the hill faces -X (rotY = -PI/2)
const cap = (level) => 10 + 5 * level // ECONOMY.capBase + capPerLevel * level

// World position of ball i's pad (mirrors buildUpgrades: the front row has one extra slot for the black hole ball).
function padOf(i) {
  let k = 0
  let j = i
  while (j >= BALL_ROWS[k]) j -= BALL_ROWS[k++]
  const slots = k === 0 ? BALL_ROWS[0] + 1 : BALL_ROWS[k]
  const lx = (j - (slots - 1) / 2) * ((24 - 3) / slots)
  const lz = 7 - 4.6 * (k + 0.5) + 0.6
  return { x: UPGRADES.x - lz, z: UPGRADES.z + lx, top: 1.2 * (k + 1) }
}

const fmt = (n) => {
  const u = ['', 'K', 'M', 'B', 'T']
  let i = 0
  let v = Math.floor(n)
  while (v >= 1000 && i < u.length - 1) (v /= 1000), i++
  return i === 0 ? String(v) : `${v >= 100 ? Math.floor(v) : Math.floor(v * 10) / 10}${u[i]}`
}

// Visual runs (playwright.visual.config.js) set metadata.pause so each step is easy to watch.
const watch = (page, testInfo) => page.waitForTimeout(testInfo.project.metadata?.pause ?? 0)

async function boot(page, save) {
  await page.addInitScript(() => {
    // Kick pops ("+N") vanish after under a second, so record them as they are added.
    window.__pops = []
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('pop')) window.__pops.push(n.textContent.trim())
    }).observe(document, { childList: true, subtree: true })
  })
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('kick-per-click:v3', JSON.stringify(s))
      sessionStorage.setItem('seeded', '1')
    }
  }, { level: 1, kickPower: 0, wins: 0, rebirths: 0, owned: [0], equipped: 0, playtime: 0, ...save })
  await page.goto('/')
  await expect(page.locator('#hud .level')).toHaveText(`Level ${save.level ?? 1}`)
  await page.waitForFunction(() => window.__game)
}

// Drops the player onto ball i's pad (the real prompt / E handling takes over from there).
async function goToPad(page, i) {
  const p = padOf(i)
  await page.evaluate(({ x, y, z }) => window.__game.teleport(x, y, z), { x: p.x, y: p.top + 0.3, z: p.z })
}

const prompt = (page) => page.locator('#hud .prompt')
const toast = (page) => page.locator('#hud .toast')
const wins = (page) => page.locator('#hud .counter.wins .n')
const press = (page, key) => page.keyboard.press(key)

// One kick (outside the lane it kicks at full power); returns the "+N" pop text. The first keypress takes
// pointer lock, after which the HUD button is unreachable and clicks act on the world, so kick with F
// (same action as a world click). The game polls input once per frame and headless frames can be slow, so
// F stays down until the pop shows up.
async function kickOnce(page) {
  await page.waitForTimeout(450) // ECONOMY.kickCooldown is 0.35 s
  const before = await page.evaluate(() => window.__pops.length)
  await page.keyboard.down('KeyF')
  try {
    await expect.poll(() => page.evaluate(() => window.__pops.length)).toBeGreaterThan(before)
  } finally {
    await page.keyboard.up('KeyF')
  }
  return page.evaluate(() => window.__pops.at(-1))
}

test('buy and equip every ball in order: wins are spent, kick power per click matches the ball', async ({ page }, testInfo) => {
  test.setTimeout(240_000)
  let w = BALLS.slice(1).reduce((s, b) => s + b.cost, 0) // exactly enough for the whole hill
  await boot(page, { wins: w })
  await expect(wins(page)).toHaveText(fmt(w))

  let level = 1
  let power = 0
  for (let i = 1; i < BALLS.length; i++) {
    const { cost, kick } = BALLS[i]
    await goToPad(page, i)
    await expect(prompt(page)).toHaveText('Press E to buy')
    await watch(page, testInfo)

    await press(page, 'KeyE')
    w -= cost
    await expect(toast(page)).toHaveText(`Ball Purchased! +${kick} Kick`)
    await expect(wins(page)).toHaveText(fmt(w))
    await expect(prompt(page)).toHaveText('Equipped') // buying equips it
    await watch(page, testInfo)

    // Two kicks with the new ball: each pop shows its power, the level bar follows the same maths.
    for (let n = 0; n < 2; n++) {
      expect(await kickOnce(page)).toContain(`+${fmt(kick)}`)
      power += kick
      while (power >= cap(level)) (power -= cap(level)), level++
      await expect(page.locator('#hud .level')).toHaveText(`Level ${level}`)
      await expect(page.locator('#hud .bartext')).toHaveText(`Kick Power: ${fmt(power)}/${fmt(cap(level))}`)
    }
    await watch(page, testInfo)
  }
  await expect(wins(page)).toHaveText('0')
})

test('not enough wins: the ball stays locked and kick power is unchanged', async ({ page }, testInfo) => {
  const i = 3 // 140 wins
  await boot(page, { wins: BALLS[i].cost - 1 })
  await goToPad(page, i)
  await expect(prompt(page)).toHaveText(`Needs ${fmt(BALLS[i].cost)} Wins`)
  await watch(page, testInfo)

  await press(page, 'KeyE')
  await expect(toast(page)).toHaveText(`Need ${fmt(BALLS[i].cost)} Wins to Buy`)
  await expect(wins(page)).toHaveText(String(BALLS[i].cost - 1))
  await expect(prompt(page)).toHaveText(`Needs ${fmt(BALLS[i].cost)} Wins`)
  expect(await kickOnce(page)).toContain(`+${BALLS[0].kick}`) // still the starter ball
  await watch(page, testInfo)
})

test('owned balls re-equip for free and switch the kick power back and forth', async ({ page }, testInfo) => {
  await boot(page, { wins: 5, owned: [0, 1, 3], equipped: 3 })
  expect(await kickOnce(page)).toContain(`+${BALLS[3].kick}`)

  for (const i of [1, 0, 3]) {
    await goToPad(page, i)
    await expect(prompt(page)).toHaveText('Press E to equip')
    await press(page, 'KeyE')
    await expect(toast(page)).toHaveText('Ball Equipped')
    await expect(prompt(page)).toHaveText('Equipped')
    await expect(wins(page)).toHaveText('5') // equipping never costs wins
    await watch(page, testInfo)
    expect(await kickOnce(page)).toContain(`+${BALLS[i].kick}`)
  }
})

test('the purchase persists: reload keeps the equipped ball and its kick power', async ({ page }) => {
  await boot(page, { wins: 10 })
  await goToPad(page, 1)
  await press(page, 'KeyE')
  await expect(toast(page)).toHaveText(`Ball Purchased! +${BALLS[1].kick} Kick`)
  await page.waitForTimeout(1200) // stats.js saves after a 1 s debounce
  await page.reload()
  await expect(wins(page)).toHaveText('0')
  expect(await kickOnce(page)).toContain(`+${BALLS[1].kick}`)
})
