import { defineConfig } from '@playwright/test'

// Uses the locally installed Chrome (no browser download). VITE_DEV_MODE skips the Bloxity SDK.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5173', channel: 'chrome', viewport: { width: 1920, height: 991 } },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    env: { VITE_DEV_MODE: 'true' },
  },
})
