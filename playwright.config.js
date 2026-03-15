// playwright.config.js
const { defineConfig } = require('@playwright/test')
module.exports = defineConfig({
  testDir: './scripts',
  testMatch: 'screenshot.js',
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 390, height: 844 }, // typical Android viewport
    deviceScaleFactor: 2,
    colorScheme: 'dark'
  },
  webServer: {
    command: '/usr/bin/node node_modules/.bin/nuxt --hostname 127.0.0.1 --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000
  }
})
