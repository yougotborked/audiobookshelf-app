// playwright.config.js
import { defineConfig } from '@playwright/test'

// package.json sets "type": "module", so this file and scripts/screenshot.js are ES modules.
// They were written with require()/module.exports, which meant `npx playwright test` could not
// even load this config - the screenshot harness has not been runnable.
export default defineConfig({
  testDir: './scripts',
  testMatch: 'screenshot.js',
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 390, height: 844 }, // typical Android viewport
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    // Sandboxes and CI images often ship a Chromium the runner did not download, at a path it
    // does not look in. Point at it with PLAYWRIGHT_CHROMIUM_PATH rather than fetching another.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}
  },
  webServer: {
    // `nuxt` takes a subcommand, and the flag is --host; the old invocation exited with
    // "Unknown command 127.0.0.1".
    command: 'npx nuxi dev --host 127.0.0.1 --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000
  }
})
