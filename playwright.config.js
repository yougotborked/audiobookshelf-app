// playwright.config.js
const { defineConfig } = require('@playwright/test')
module.exports = defineConfig({
  testDir: './scripts',
  testMatch: 'screenshot.js',
  use: {
    baseURL: 'http://localhost:1337',
    viewport: { width: 390, height: 844 }, // typical Android viewport
    deviceScaleFactor: 2,
    colorScheme: 'dark'
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1337',
    reuseExistingServer: true,
    timeout: 60000
  }
})
