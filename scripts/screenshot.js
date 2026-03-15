// scripts/screenshot.js
const { test } = require('@playwright/test')
const path = require('path')
const fs = require('fs')

const TIMESTAMP = new Date().toISOString().slice(0, 16).replace('T', '-').replace(/:/g, '-')
const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots', TIMESTAMP)

// Mock auth state injected into every page before load
const MOCK_USER = {
  id: 'usr_mock01', username: 'mockuser', type: 'admin', token: 'mock-token-abc123',
  mediaProgress: [], permissions: { download: true, update: true, delete: true }
}
const MOCK_AUTH = {
  'abs-user': JSON.stringify(MOCK_USER),
  'abs-server-config': JSON.stringify({
    id: 'cfg_mock01', name: 'Mock Server', address: 'http://localhost:1337', token: 'mock-token-abc123'
  })
}

const MOCK_LIBRARIES = {
  libraries: [
    { id: 'lib_audiobooks', name: 'Audiobooks', mediaType: 'book', icon: 'database', folders: [] },
    { id: 'lib_podcasts', name: 'Podcasts', mediaType: 'podcast', icon: 'podcast', folders: [] }
  ]
}

const MOCK_ITEMS = {
  results: [
    { id: 'li_001', libraryId: 'lib_audiobooks', mediaType: 'book', media: { metadata: { title: 'Project Hail Mary', authorName: 'Andy Weir' }, coverPath: null, duration: 64800, numTracks: 18 }, userMediaProgress: { currentTime: 12600, progress: 0.19, isFinished: false } },
    { id: 'li_002', libraryId: 'lib_audiobooks', mediaType: 'book', media: { metadata: { title: "The Hitchhiker's Guide to the Galaxy", authorName: 'Douglas Adams' }, coverPath: null, duration: 18000, numTracks: 5 }, userMediaProgress: { currentTime: 18000, progress: 1.0, isFinished: true } },
    { id: 'li_003', libraryId: 'lib_audiobooks', mediaType: 'book', media: { metadata: { title: 'Dune', authorName: 'Frank Herbert' }, coverPath: null, duration: 77400, numTracks: 21 }, userMediaProgress: null },
    { id: 'li_004', libraryId: 'lib_audiobooks', mediaType: 'book', media: { metadata: { title: 'Recursion', authorName: 'Blake Crouch' }, coverPath: null, duration: 43200, numTracks: 12 }, userMediaProgress: { currentTime: 0, progress: 0, isFinished: false } },
    { id: 'li_005', libraryId: 'lib_audiobooks', mediaType: 'book', media: { metadata: { title: 'The Name of the Wind', authorName: 'Patrick Rothfuss' }, coverPath: null, duration: 108000, numTracks: 28 }, userMediaProgress: { currentTime: 54000, progress: 0.5, isFinished: false } }
  ],
  total: 5, page: 0, limit: 50
}

async function setupMockAuth(page) {
  await page.addInitScript((auth) => {
    for (const [k, v] of Object.entries(auth)) localStorage.setItem(k, v)
  }, MOCK_AUTH)

  await page.route('**/api/me', route => route.fulfill({ json: MOCK_USER }))
  await page.route('**/api/libraries', route => route.fulfill({ json: MOCK_LIBRARIES }))
  await page.route('**/api/libraries/*/items', route => route.fulfill({ json: MOCK_ITEMS }))
  await page.route('**/api/**', route => route.fulfill({ status: 200, json: {} }))
  await page.route('**/socket.io/**', route => route.abort())
}

function shot(name) {
  return path.join(OUT_DIR, `${name}.png`)
}

test.beforeAll(() => { fs.mkdirSync(OUT_DIR, { recursive: true }) })

test('connect page', async ({ page }) => {
  await page.goto('/connect')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: shot('01-connect'), fullPage: true })
})

test('bookshelf page', async ({ page }) => {
  await setupMockAuth(page)
  await page.goto('/bookshelf')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: shot('02-bookshelf'), fullPage: true })
})

test('settings page', async ({ page }) => {
  await setupMockAuth(page)
  await page.goto('/settings')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: shot('03-settings'), fullPage: true })
})

test('downloads page', async ({ page }) => {
  await setupMockAuth(page)
  await page.goto('/downloads')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: shot('04-downloads'), fullPage: true })
})

test('search page', async ({ page }) => {
  await setupMockAuth(page)
  await page.goto('/search')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: shot('05-search'), fullPage: true })
})
