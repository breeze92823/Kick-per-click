import { defineConfig } from '@playwright/test'
import base from './playwright.config.js'

// Watchable run: real browser window, slowed actions, a pause after each step.
// npm run test:e2e:visual
export default defineConfig({
  ...base,
  workers: 1,
  timeout: 300_000,
  projects: [
    {
      name: 'visual',
      metadata: { pause: 900 },
      use: { headless: false, launchOptions: { slowMo: 150 } },
    },
  ],
})
