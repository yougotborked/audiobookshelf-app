// playwright.config.js
import { defineConfig } from '@playwright/test'

// package.json sets "type": "module", so this file and everything under test/e2e are ES modules.
// They were written with require()/module.exports, which meant `npx playwright test` could not
// even load this config - the harness had never actually run.
export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.spec.ts',
  // Each spec boots the whole app against a fake server; serialising keeps the dev server's
  // module graph from being hammered by parallel cold starts.
  workers: 2,
  // A screenshot run is for looking at, not for gating - a retry would only hide a boot failure.
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    // Sandboxes and CI images often ship a Chromium the runner did not download, at a path it
    // does not look in. Point at it with PLAYWRIGHT_CHROMIUM_PATH rather than fetching another.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}
  },
  webServer: {
    // `nuxi` takes a subcommand and the flag is --host; the old invocation exited with
    // "Unknown command 127.0.0.1".
    command: 'npx nuxi dev --host 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 180000
  }
})
