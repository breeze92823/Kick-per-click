import { test, expect } from '@playwright/test'

// Mirrors ECONOMY.rebirthLevels / rebirthLevelStep in src/config.js.
const LEVELS = [20, 40, 60, 80, 100, 125, 150]
const need = (r) => (r < LEVELS.length ? LEVELS[r] : LEVELS.at(-1) + 25 * (r - LEVELS.length + 1))
const cap = (level) => 10 + 5 * level // ECONOMY.capBase + capPerLevel * level

// Boots the game with a saved state: `rebirths` done, at `level`, with `power` kick power.
async function boot(page, { rebirths, level, power }) {
  await page.addInitScript((save) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('kick-per-click:v3', JSON.stringify(save))
      sessionStorage.setItem('seeded', '1')
    }
  }, { level, kickPower: power, wins: 0, rebirths, owned: [0], equipped: 0, playtime: 0 })
  await page.goto('/')
  await expect(page.locator('#hud .level')).toHaveText(`Level ${level}`)
}

const openRebirth = (page) => page.locator('#hud [data-act="rebirth"]').click()
const goButton = (page) => page.locator('#hud .rbgo')

for (const r of [0, 1, 2, 3, 4, 5, 6, 7]) {
  const lvl = need(r)
  test(`rebirth #${r + 1}: kick to level ${lvl}, open window, click Rebirth`, async ({ page }) => {
    // One level short, bar almost full: a single real KICK click crosses the threshold.
    await boot(page, { rebirths: r, level: lvl - 1, power: cap(lvl - 1) - 1 })

    // Below the required level the button is greyed out and does nothing.
    await openRebirth(page)
    await expect(page.locator('#hud .modal.show')).toBeVisible()
    await expect(goButton(page)).toHaveClass(/off/)
    await goButton(page).click()
    await expect(page.locator('#hud .counter.rebirths .n')).toHaveText(String(r))
    await page.locator('#hud .rbclose[data-act="closeRebirth"]').click()
    await expect(page.locator('#hud .modal.show')).toHaveCount(0)

    // Kick (HUD KICK! button) until the rebirth level is reached.
    await page.locator('#hud .kick').click()
    await expect(page.locator('#hud .level')).toHaveText(`Level ${lvl}`)

    // Now the window shows full progress and the button is active.
    await openRebirth(page)
    await expect(page.locator('#hud .rblevel')).toHaveText(`LEVEL: ${lvl}/${lvl}`)
    await expect(goButton(page)).not.toHaveClass(/off/)
    await goButton(page).click()

    // Rebirth applied: counter up, level reset, window closed.
    await expect(page.locator('#hud .counter.rebirths .n')).toHaveText(String(r + 1))
    await expect(page.locator('#hud .level')).toHaveText('Level 1')
    await expect(page.locator('#hud .modal.show')).toHaveCount(0)
    await expect(page.locator('#hud .toast')).toHaveText(`Rebirth ${r + 1}!`)

    // The next rebirth now needs a higher level.
    await openRebirth(page)
    await expect(page.locator('#hud .rblevel')).toHaveText(`LEVEL: 1/${need(r + 1)}`)
    await expect(goButton(page)).toHaveClass(/off/)
  })
}
