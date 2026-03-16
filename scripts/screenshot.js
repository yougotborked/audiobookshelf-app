// scripts/screenshot.js
const { test } = require('@playwright/test')
const path = require('path')
const fs = require('fs')

const TIMESTAMP = new Date().toISOString().slice(0, 16).replace('T', '-').replace(/:/g, '-')
const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots', TIMESTAMP)

// Mock auth state injected into every page before load
const MOCK_USER = {
  id: 'usr_mock01', username: 'mockuser', type: 'admin', token: 'mock-token-abc123',
  mediaProgress: [], permissions: { download: true, update: true, delete: true },
  librariesAccessible: []
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

const MOCK_PODCAST_ITEMS = {
  results: [
    { id: 'lp_001', libraryId: 'lib_podcasts', mediaType: 'podcast', media: { metadata: { title: 'Hardcore History', author: 'Dan Carlin' }, coverPath: null, numEpisodes: 72 }, userMediaProgress: { currentTime: 3600, progress: 0.12, isFinished: false } },
    { id: 'lp_002', libraryId: 'lib_podcasts', mediaType: 'podcast', media: { metadata: { title: 'Lex Fridman Podcast', author: 'Lex Fridman' }, coverPath: null, numEpisodes: 410 }, userMediaProgress: null },
    { id: 'lp_003', libraryId: 'lib_podcasts', mediaType: 'podcast', media: { metadata: { title: 'The Tim Ferriss Show', author: 'Tim Ferriss' }, coverPath: null, numEpisodes: 700 }, userMediaProgress: { currentTime: 1800, progress: 0.45, isFinished: false } },
    { id: 'lp_004', libraryId: 'lib_podcasts', mediaType: 'podcast', media: { metadata: { title: 'Darknet Diaries', author: 'Jack Rhysider' }, coverPath: null, numEpisodes: 148 }, userMediaProgress: { currentTime: 0, progress: 0, isFinished: false } }
  ],
  total: 4, page: 0, limit: 50
}

async function setupMockAuth(page, { libraryId } = {}) {
  const auth = libraryId
    ? { ...MOCK_AUTH, '_cap_lastLibraryId': libraryId }
    : MOCK_AUTH
  await page.addInitScript((a) => {
    for (const [k, v] of Object.entries(a)) localStorage.setItem(k, v)
  }, auth)

  await page.route('**/api/me', route => route.fulfill({ json: MOCK_USER }))
  await page.route('**/api/libraries', route => route.fulfill({ json: MOCK_LIBRARIES }))
  await page.route('**/api/libraries/lib_podcasts/items', route => route.fulfill({ json: MOCK_PODCAST_ITEMS }))
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

test('bookshelf - podcast library', async ({ page }) => {
  await setupMockAuth(page, { libraryId: 'lib_podcasts' })
  await page.goto('/bookshelf')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: shot('02b-bookshelf-podcasts'), fullPage: true })
})

test('libraries modal', async ({ page }) => {
  await setupMockAuth(page)
  await page.goto('/bookshelf')
  await page.waitForTimeout(2000)
  // Inject auth + library state directly into Vuex store (Capacitor DB not available in web/test)
  const storeData = { user: MOCK_USER, libraries: MOCK_LIBRARIES.libraries }
  await page.evaluate((data) => {
    const store = window.$nuxt?.$store
    if (!store) return
    store.commit('user/setUser', data.user)
    store.commit('libraries/set', data.libraries)
    store.commit('libraries/setCurrentLibrary', data.libraries[0].id)
  }, storeData)
  await page.waitForSelector('[aria-label="Show library modal"]', { timeout: 5000 })
  await page.click('[aria-label="Show library modal"]')
  await page.waitForTimeout(600)
  await page.screenshot({ path: shot('02c-libraries-modal'), fullPage: true })
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
