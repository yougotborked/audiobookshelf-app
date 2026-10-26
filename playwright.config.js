// playwright.config.js
import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

// Where a sandbox or CI image tends to leave a Chromium the runner did not download itself.
// Playwright looks only in its own cache, keyed by the exact build its version pins, so a
// perfectly good browser one directory away reads as "Executable doesn't exist".
const KNOWN_CHROMIUM_PATHS = ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser']

function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH
  return KNOWN_CHROMIUM_PATHS.find((path) => existsSync(path)) || null
}

const chromiumPath = findChromium()

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
    // Use whatever Chromium is already here rather than fetching another. PLAYWRIGHT_CHROMIUM_PATH
    // overrides; failing that the usual sandbox locations are tried, and failing that Playwright
    // falls back to its own cache as normal.
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {}
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
