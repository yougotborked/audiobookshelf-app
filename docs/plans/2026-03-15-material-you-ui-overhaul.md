# Material You UI Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` to implement this plan.

**Goal:** Apply a Material Design 3-inspired design system to the audiobookshelf Android app (NuxtJS 2 + Tailwind + Vue in Capacitor WebView), improving visual hierarchy, typography, elevation, and key screens — dark theme, subtle motion, Android-first.

**Architecture:** New M3 CSS custom properties added to `assets/tailwind.css`; Tailwind config extended with M3 type-scale utilities and surface colours; all ui/* components updated to speak M3 tokens; five key screens deep-dived with dynamic colour extraction on the player via the existing `fast-average-color` dependency.

**Tech Stack:** Vue 2, NuxtJS 2, Tailwind CSS 3, Capacitor Android, fast-average-color (already installed), Playwright (Phase 0 only — devDep, not shipped in APK)

---

## Phase 0 — Visual Testing Pipeline

### Task 0.1: Install Playwright in distrobox

**Files:**
- Modify: `package.json`

**Step 1: Install Playwright as devDep inside distrobox**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app
npm install --save-dev @playwright/test
npx playwright install chromium
EOF
```
Expected: `node_modules/@playwright/test` exists, chromium browser downloaded.

**Step 2: Verify**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app
npx playwright --version
EOF
```
Expected: prints version like `Version 1.x.x`

**Step 3: Commit**
```bash
cd ~/workspace/audiobookshelf-app
git add package.json package-lock.json
git commit -m "chore: add Playwright devDep for visual screenshot pipeline"
```

---

### Task 0.2: Create mock API server data

**Files:**
- Create: `mock/db.json`
- Create: `mock/routes.json`
- Modify: `.gitignore`

**Step 1: Create mock directory and data**

Create `mock/db.json` with realistic ABS API shape:
```json
{
  "me": {
    "id": "usr_mock01",
    "username": "mockuser",
    "type": "admin",
    "token": "mock-token-abc123",
    "mediaProgress": [],
    "permissions": { "download": true, "update": true, "delete": true, "upload": true, "accessAllLibraries": true, "accessAllTags": true, "accessExplicitContent": true },
    "librariesAccessible": [],
    "itemTagsSelected": []
  },
  "libraries": [
    { "id": "lib_audiobooks", "name": "Audiobooks", "folders": [{ "id": "fol_1", "fullPath": "/audiobooks", "libraryId": "lib_audiobooks" }], "mediaType": "book", "icon": "database", "settings": {} },
    { "id": "lib_podcasts", "name": "Podcasts", "folders": [{ "id": "fol_2", "fullPath": "/podcasts", "libraryId": "lib_podcasts" }], "mediaType": "podcast", "icon": "podcast", "settings": {} }
  ],
  "libraryItems": [
    { "id": "li_001", "libraryId": "lib_audiobooks", "mediaType": "book", "media": { "metadata": { "title": "Project Hail Mary", "authorName": "Andy Weir", "description": "A lone astronaut must save the earth from disaster." }, "coverPath": null, "duration": 64800, "numTracks": 18 }, "userMediaProgress": { "currentTime": 12600, "progress": 0.19, "isFinished": false } },
    { "id": "li_002", "libraryId": "lib_audiobooks", "mediaType": "book", "media": { "metadata": { "title": "The Hitchhiker's Guide to the Galaxy", "authorName": "Douglas Adams", "description": "Moments before Earth is demolished to make way for a hyperspace bypass." }, "coverPath": null, "duration": 18000, "numTracks": 5 }, "userMediaProgress": { "currentTime": 18000, "progress": 1.0, "isFinished": true } },
    { "id": "li_003", "libraryId": "lib_audiobooks", "mediaType": "book", "media": { "metadata": { "title": "Dune", "authorName": "Frank Herbert", "description": "Set on the desert planet Arrakis." }, "coverPath": null, "duration": 77400, "numTracks": 21 }, "userMediaProgress": null },
    { "id": "li_004", "libraryId": "lib_audiobooks", "mediaType": "book", "media": { "metadata": { "title": "Recursion", "authorName": "Blake Crouch", "description": "Memory makes reality." }, "coverPath": null, "duration": 43200, "numTracks": 12 }, "userMediaProgress": { "currentTime": 0, "progress": 0, "isFinished": false } },
    { "id": "li_005", "libraryId": "lib_audiobooks", "mediaType": "book", "media": { "metadata": { "title": "The Name of the Wind", "authorName": "Patrick Rothfuss", "description": "The tale of Kvothe." }, "coverPath": null, "duration": 108000, "numTracks": 28 }, "userMediaProgress": { "currentTime": 54000, "progress": 0.5, "isFinished": false } }
  ]
}
```

Create `mock/routes.json`:
```json
{
  "/api/me": "/me",
  "/api/libraries": "/libraries",
  "/api/libraries/:id/items": "/libraryItems"
}
```

Add to `.gitignore`:
```
# Visual testing mock data
mock/
docs/screenshots/
playwright-report/
```

**Step 2: Verify**
```bash
ls mock/db.json mock/routes.json
```
Expected: both files exist.

**Step 3: Commit**
```bash
cd ~/workspace/audiobookshelf-app
git add mock/ .gitignore
git commit -m "chore: add mock API data for visual testing pipeline"
```

---

### Task 0.3: Write Playwright screenshot script

**Files:**
- Create: `scripts/screenshot.js`
- Create: `playwright.config.js`

**Step 1: Create `playwright.config.js` at repo root**
```js
// playwright.config.js
const { defineConfig, devices } = require('@playwright/test')
module.exports = defineConfig({
  testDir: './scripts',
  testMatch: 'screenshot.js',
  use: {
    baseURL: 'http://localhost:1337',
    viewport: { width: 390, height: 844 }, // iPhone 14 / typical Android
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
```

**Step 2: Create `scripts/screenshot.js`**
```js
// scripts/screenshot.js
const { test } = require('@playwright/test')
const path = require('path')
const fs = require('fs')

const TIMESTAMP = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '-')
const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots', TIMESTAMP)

// Mock auth state injected into every page before load
const MOCK_AUTH = {
  'abs-user': JSON.stringify({
    id: 'usr_mock01', username: 'mockuser', type: 'admin', token: 'mock-token-abc123',
    mediaProgress: [], permissions: { download: true, update: true, delete: true }
  }),
  'abs-server-config': JSON.stringify({
    id: 'cfg_mock01', name: 'Mock Server', address: 'http://localhost:1337', token: 'mock-token-abc123'
  })
}

async function setupMockAuth(page) {
  await page.addInitScript((auth) => {
    for (const [k, v] of Object.entries(auth)) localStorage.setItem(k, v)
  }, MOCK_AUTH)

  // Intercept all /api/ calls and return mock responses
  await page.route('**/api/me', route => route.fulfill({ json: JSON.parse(MOCK_AUTH['abs-user']) }))
  await page.route('**/api/libraries', route => route.fulfill({ json: {
    libraries: [
      { id: 'lib_audiobooks', name: 'Audiobooks', mediaType: 'book', icon: 'database', folders: [] },
      { id: 'lib_podcasts', name: 'Podcasts', mediaType: 'podcast', icon: 'podcast', folders: [] }
    ]
  }}))
  await page.route('**/api/libraries/*/items', route => route.fulfill({ json: {
    results: [], total: 0, page: 0, limit: 50
  }}))
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
```

**Step 3: Verify script is syntactically valid**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app
node -e "require('./playwright.config.js'); console.log('config ok')"
node -c scripts/screenshot.js && echo "script ok"
EOF
```
Expected: `config ok` and `script ok`

**Step 4: Commit**
```bash
cd ~/workspace/audiobookshelf-app
git add scripts/screenshot.js playwright.config.js
git commit -m "chore: add Playwright screenshot script for visual regression baseline"
```

---

### Task 0.4: Take baseline screenshots

**Step 1: Run screenshot suite**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app
npx playwright test scripts/screenshot.js --reporter=line 2>&1
EOF
```
Expected: 5 tests pass, PNG files written to `docs/screenshots/<timestamp>/`.

**Step 2: Verify screenshots exist and are viewable**
```bash
ls ~/workspace/audiobookshelf-app/docs/screenshots/*/
```
Expected: 5 PNG files visible.

> **Claude note:** After this step, READ each PNG file using the Read tool to visually inspect the current state before making any Phase 1 changes.

---

## Phase 1 — Design Token System

### Task 1.1: Rewrite `assets/tailwind.css` with M3 tokens

**Files:**
- Modify: `assets/tailwind.css`

**Step 1: Replace the file contents**

New content for `assets/tailwind.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* ── M3 Surface Elevation (dark theme tinting model) ── */
  --md-surface-0: 18 18 18;        /* base bg */
  --md-surface-1: 30 30 30;        /* cards at rest, +5% tint */
  --md-surface-2: 34 34 34;        /* FAB, chips, +8% tint */
  --md-surface-3: 39 39 39;        /* modals, drawers, +11% tint */
  --md-surface-4: 40 40 40;        /* nav bar, app bar, +12% tint */
  --md-surface-5: 44 44 44;        /* tooltips, +14% tint */

  /* ── M3 Colour Roles ── */
  --md-primary:              26 214 145;   /* #1ad691 — keep existing accent */
  --md-on-primary:           0 56 40;
  --md-primary-container:    0 81 61;
  --md-on-primary-container: 110 245 195;
  --md-secondary:            178 204 192;
  --md-on-secondary:         29 53 44;
  --md-secondary-container:  52 75 67;
  --md-on-secondary-container: 204 228 218;
  --md-error:                255 180 171;
  --md-on-error:             105 0 5;
  --md-error-container:      147 0 10;
  --md-on-error-container:   255 218 214;
  --md-outline:              142 153 148;
  --md-outline-variant:      63 73 69;

  /* ── M3 Text Roles ── */
  --md-on-surface:           226 232 229;  /* primary text */
  --md-on-surface-variant:   178 204 192;  /* secondary text */

  /* ── Dynamic colour (set by fast-average-color on Now Playing) ── */
  --dynamic-primary:         26 214 145;
  --dynamic-surface:         18 18 18;

  /* ── M3 Shape ── */
  --md-shape-xs:   4px;
  --md-shape-sm:   8px;
  --md-shape-md:   12px;
  --md-shape-lg:   16px;
  --md-shape-xl:   28px;
  --md-shape-full: 9999px;

  /* ── M3 Motion (durations + easings) ── */
  --md-motion-standard:   200ms cubic-bezier(0.2, 0, 0, 1);
  --md-motion-emphasized: 300ms cubic-bezier(0.2, 0, 0, 1);
  --md-motion-decelerate: 250ms cubic-bezier(0, 0, 0, 1);
  --md-motion-accelerate: 200ms cubic-bezier(0.3, 0, 1, 1);

  /* ── Backward-compat aliases (keep until Phase 2 replaces usages) ── */
  --color-bg:             rgb(var(--md-surface-0));
  --color-bg-hover:       rgb(var(--md-surface-2));
  --color-fg:             rgb(var(--md-on-surface));
  --color-fg-muted:       rgb(var(--md-on-surface-variant));
  --color-primary:        rgb(var(--md-surface-1));
  --color-secondary:      rgb(var(--md-surface-2));
  --color-border:         rgb(var(--md-outline-variant));
  --color-bg-toggle:      rgb(var(--md-surface-1));
  --color-bg-toggle-selected: rgb(var(--md-surface-3));
  --color-track-cursor:   rgb(var(--md-on-surface));
  --color-track:          rgb(var(--md-outline));
  --color-track-buffered: rgb(var(--md-surface-4));
  --gradient-item-page:   linear-gradient(rgb(var(--md-surface-0)) 0%, rgb(var(--md-surface-2)) 100%);
  --gradient-audio-player: linear-gradient(0deg, rgb(var(--md-surface-0)) 0%, transparent 100%);
  --gradient-minimized-audio-player: linear-gradient(180deg, transparent 0%, rgb(var(--md-surface-4)) 100%);
}

/* Black theme overrides */
html[data-theme='black'] {
  --md-surface-0: 0 0 0;
  --md-surface-1: 12 12 12;
  --md-surface-2: 18 18 18;
  --md-surface-3: 22 22 22;
  --md-surface-4: 24 24 24;
  --md-surface-5: 28 28 28;
  --md-on-surface: 230 237 243;
  --md-on-surface-variant: 120 126 132;
  --color-bg: rgb(var(--md-surface-0));
  --color-fg: rgb(var(--md-on-surface));
  --color-fg-muted: rgb(var(--md-on-surface-variant));
  --color-primary: rgb(var(--md-surface-1));
  --color-secondary: rgb(var(--md-surface-2));
}

/* Light theme overrides */
html[data-theme='light'] {
  --md-surface-0: 254 247 255;
  --md-surface-1: 243 238 247;
  --md-surface-2: 237 232 241;
  --md-surface-3: 231 226 235;
  --md-surface-4: 229 224 233;
  --md-surface-5: 225 220 230;
  --md-on-surface: 29 27 32;
  --md-on-surface-variant: 74 68 78;
  --md-outline: 124 117 126;
  --md-outline-variant: 204 196 206;
  --color-bg: rgb(var(--md-surface-0));
  --color-fg: rgb(var(--md-on-surface));
  --color-fg-muted: rgb(var(--md-on-surface-variant));
  --color-border: rgb(var(--md-outline-variant));
  --color-primary: rgb(var(--md-surface-1));
  --color-secondary: rgb(var(--md-surface-2));
}
```

**Step 2: Verify build**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app && npm run build 2>&1 | tail -5
EOF
```
Expected: `Generated` output, no errors.

**Step 3: Commit**
```bash
cd ~/workspace/audiobookshelf-app
git add assets/tailwind.css
git commit -m "style: replace flat grey tokens with M3 surface elevation + colour roles"
```

---

### Task 1.2: Extend `tailwind.config.js` with M3 utilities

**Files:**
- Modify: `tailwind.config.js`

**Step 1: Replace with updated config**

Replace the full file with:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['components/**/*.vue', 'layouts/**/*.vue', 'pages/**/*.vue', 'mixins/**/*.js', 'plugins/**/*.js'],
  theme: {
    screens: {
      short: { raw: '(max-height: 500px)' }
    },
    extend: {
      /* ── Backward-compat semantic colours ── */
      colors: {
        bg: 'rgb(var(--md-surface-0) / <alpha-value>)',
        'bg-hover': 'rgb(var(--md-surface-2) / <alpha-value>)',
        fg: 'rgb(var(--md-on-surface) / <alpha-value>)',
        'fg-muted': 'rgb(var(--md-on-surface-variant) / <alpha-value>)',
        border: 'rgb(var(--md-outline-variant) / <alpha-value>)',
        accent: '#1ad691',
        error: '#FF5252',
        success: '#4CAF50',
        successDark: '#3b8a3e',
        warning: '#FB8C00',
        info: '#2196F3',
        /* ── M3 surface levels (direct use) ── */
        'md-surface-0': 'rgb(var(--md-surface-0) / <alpha-value>)',
        'md-surface-1': 'rgb(var(--md-surface-1) / <alpha-value>)',
        'md-surface-2': 'rgb(var(--md-surface-2) / <alpha-value>)',
        'md-surface-3': 'rgb(var(--md-surface-3) / <alpha-value>)',
        'md-surface-4': 'rgb(var(--md-surface-4) / <alpha-value>)',
        'md-surface-5': 'rgb(var(--md-surface-5) / <alpha-value>)',
        'md-primary': 'rgb(var(--md-primary) / <alpha-value>)',
        'md-on-primary': 'rgb(var(--md-on-primary) / <alpha-value>)',
        'md-primary-container': 'rgb(var(--md-primary-container) / <alpha-value>)',
        'md-on-primary-container': 'rgb(var(--md-on-primary-container) / <alpha-value>)',
        'md-on-surface': 'rgb(var(--md-on-surface) / <alpha-value>)',
        'md-on-surface-variant': 'rgb(var(--md-on-surface-variant) / <alpha-value>)',
        'md-outline': 'rgb(var(--md-outline) / <alpha-value>)',
        'md-outline-variant': 'rgb(var(--md-outline-variant) / <alpha-value>)',
        'md-error': 'rgb(var(--md-error) / <alpha-value>)',
        'md-error-container': 'rgb(var(--md-error-container) / <alpha-value>)',
        'dynamic-primary': 'rgb(var(--dynamic-primary) / <alpha-value>)',
        'dynamic-surface': 'rgb(var(--dynamic-surface) / <alpha-value>)',
      },
      /* ── M3 Type Scale ── */
      fontSize: {
        'md-display-l':  ['3.5625rem',  { lineHeight: '4rem',    letterSpacing: '-0.015625rem', fontWeight: '400' }],
        'md-display-m':  ['2.8125rem',  { lineHeight: '3.25rem', letterSpacing: '0',            fontWeight: '400' }],
        'md-display-s':  ['2.25rem',    { lineHeight: '2.75rem', letterSpacing: '0',            fontWeight: '400' }],
        'md-headline-l': ['2rem',       { lineHeight: '2.5rem',  letterSpacing: '0',            fontWeight: '400' }],
        'md-headline-m': ['1.75rem',    { lineHeight: '2.25rem', letterSpacing: '0',            fontWeight: '400' }],
        'md-headline-s': ['1.5rem',     { lineHeight: '2rem',    letterSpacing: '0',            fontWeight: '400' }],
        'md-title-l':    ['1.375rem',   { lineHeight: '1.75rem', letterSpacing: '0',            fontWeight: '400' }],
        'md-title-m':    ['1rem',       { lineHeight: '1.5rem',  letterSpacing: '0.009375rem',  fontWeight: '500' }],
        'md-title-s':    ['0.875rem',   { lineHeight: '1.25rem', letterSpacing: '0.00625rem',   fontWeight: '500' }],
        'md-body-l':     ['1rem',       { lineHeight: '1.5rem',  letterSpacing: '0.03125rem',   fontWeight: '400' }],
        'md-body-m':     ['0.875rem',   { lineHeight: '1.25rem', letterSpacing: '0.015625rem',  fontWeight: '400' }],
        'md-body-s':     ['0.75rem',    { lineHeight: '1rem',    letterSpacing: '0.025rem',     fontWeight: '400' }],
        'md-label-l':    ['0.875rem',   { lineHeight: '1.25rem', letterSpacing: '0.00625rem',   fontWeight: '500' }],
        'md-label-m':    ['0.75rem',    { lineHeight: '1rem',    letterSpacing: '0.03125rem',   fontWeight: '500' }],
        'md-label-s':    ['0.6875rem',  { lineHeight: '1rem',    letterSpacing: '0.03125rem',   fontWeight: '500' }],
      },
      /* ── M3 Shape ── */
      borderRadius: {
        'md-xs': 'var(--md-shape-xs)',
        'md-sm': 'var(--md-shape-sm)',
        'md-md': 'var(--md-shape-md)',
        'md-lg': 'var(--md-shape-lg)',
        'md-xl': 'var(--md-shape-xl)',
        'md-full': 'var(--md-shape-full)',
      },
      fontFamily: {
        sans: ['Source Sans Pro', 'sans-serif'],
        mono: ['Ubuntu Mono', 'monospace'],
      },
      spacing: {
        '4.5': '1.125rem',
        '18': '4.5rem',
      },
      minWidth: {
        '1': '0.25rem',
        '2': '0.5rem',
        '2.5': '0.625rem',
        '3': '0.75rem',
        '4': '1rem',
      },
      minHeight: { '12': '3rem' },
      maxWidth: { '24': '6rem' },
      height: { '18': '4.5rem' },
    }
  },
  plugins: []
}
```

**Step 2: Verify build**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app && npm run build 2>&1 | tail -5
EOF
```
Expected: no errors, `Generated` output.

**Step 3: Commit**
```bash
git add tailwind.config.js
git commit -m "style: extend Tailwind config with M3 type scale, surface colours, shape tokens"
```

---

### Task 1.3: Update `assets/app.css` — remove wood texture, update shadows

**Files:**
- Modify: `assets/app.css`

**Step 1: Remove skeuomorphic bookshelf styles and update shadows**

Find and remove the `.bookshelfRow`, `.bookshelfDivider`, `.categoryPlacard`, `.shinyBlack`, `.altBookshelfLabel` blocks entirely.

Replace the box-shadow utility block (currently lines ~44–66) with:
```css
/* M3 elevation shadows — used sparingly (tinting is primary elevation signal) */
.elevation-1 { box-shadow: 0 1px 2px rgba(0,0,0,.3), 0 1px 3px 1px rgba(0,0,0,.15); }
.elevation-2 { box-shadow: 0 1px 2px rgba(0,0,0,.3), 0 2px 6px 2px rgba(0,0,0,.15); }
.elevation-3 { box-shadow: 0 4px 8px 3px rgba(0,0,0,.15), 0 1px 3px rgba(0,0,0,.3); }
.elevation-4 { box-shadow: 0 6px 10px 4px rgba(0,0,0,.15), 0 2px 3px rgba(0,0,0,.3); }
/* Keep legacy aliases so nothing breaks during transition */
.box-shadow-sm  { @apply elevation-1; }
.box-shadow-md  { @apply elevation-2; }
.box-shadow-lg-up { box-shadow: 0 -8px 12px rgba(0,0,0,.4); }
.box-shadow-xl  { @apply elevation-4; }
.box-shadow-book { @apply elevation-3; }
```

Also add the standard motion utilities at the bottom of `app.css`:
```css
/* M3 motion utilities — disabled when user prefers reduced motion */
@media (prefers-reduced-motion: no-preference) {
  .transition-md-standard  { transition: all var(--md-motion-standard); }
  .transition-md-emphasized { transition: all var(--md-motion-emphasized); }
  .transition-md-decelerate { transition: all var(--md-motion-decelerate); }
  .transition-md-accelerate { transition: all var(--md-motion-accelerate); }
}
/* Static fallback (instant) when prefers-reduced-motion: reduce */
.transition-md-standard,
.transition-md-emphasized,
.transition-md-decelerate,
.transition-md-accelerate  { transition: none; }
@media (prefers-reduced-motion: no-preference) {
  .transition-md-standard  { transition: all var(--md-motion-standard); }
  .transition-md-emphasized { transition: all var(--md-motion-emphasized); }
  .transition-md-decelerate { transition: all var(--md-motion-decelerate); }
  .transition-md-accelerate { transition: all var(--md-motion-accelerate); }
}
```

**Step 2: Verify build + lint**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app && npm run build 2>&1 | tail -5
EOF
```
Expected: clean build.

**Step 3: Commit**
```bash
git add assets/app.css
git commit -m "style: remove skeuomorphic wood bookshelf, update shadows to M3 elevation model"
```

---

## Phase 2 — Global Component Library

### Task 2.1: Rewrite `components/ui/Btn.vue` — M3 button variants

**Files:**
- Modify: `components/ui/Btn.vue`

**Step 1: Replace the component**

Add a `variant` prop with values: `filled` (default), `filled-tonal`, `outlined`, `text`, `elevated`.
Keep backward compat: existing `color` prop still works for `filled` variant.

Key changes to the `classList` computed:
- Base: `inline-flex items-center justify-center gap-2 font-medium text-md-label-l rounded-md-full select-none transition-md-standard relative overflow-hidden`
- `filled`: `bg-md-primary text-md-on-primary` (when color=primary/default) or existing color logic
- `filled-tonal`: `bg-md-primary-container text-md-on-primary-container`
- `outlined`: `bg-transparent border border-md-outline text-md-primary`
- `text`: `bg-transparent text-md-primary`
- `elevated`: `bg-md-surface-1 text-md-primary elevation-1`
- Press state: add `active:scale-[0.97] active:brightness-90` to all variants
- Disabled: `opacity-38 cursor-not-allowed pointer-events-none`

Full rewrite of `Btn.vue`:
```vue
<template>
  <nuxt-link v-if="to" :to="to" :class="classList" @click.native="click">
    <span v-if="loading" class="absolute inset-0 flex items-center justify-center bg-inherit rounded-inherit">
      <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
    </span>
    <slot />
  </nuxt-link>
  <button v-else :type="type || 'button'" :disabled="disabled || loading" :class="classList" @click="click">
    <span v-if="loading" class="absolute inset-0 flex items-center justify-center bg-inherit">
      <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
    </span>
    <slot />
  </button>
</template>

<script>
export default {
  props: {
    to: String,
    variant: { type: String, default: 'filled' }, // filled | filled-tonal | outlined | text | elevated
    color: { type: String, default: 'primary' },  // backward-compat
    type: String,
    paddingX: Number,
    paddingY: Number,
    small: Boolean,
    loading: Boolean,
    disabled: Boolean
  },
  computed: {
    classList() {
      const base = [
        'inline-flex items-center justify-center gap-2 font-medium select-none',
        'text-md-label-l rounded-md-full transition-md-standard relative overflow-hidden',
        'active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'focus-visible:outline-md-primary',
        this.small ? 'h-8 px-4 text-md-label-m' : 'h-10 px-6',
        this.paddingX != null ? `px-${this.paddingX}` : '',
        this.paddingY != null ? `py-${this.paddingY}` : '',
        (this.disabled || this.loading) ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
      ]

      const variants = {
        'filled':       'bg-md-primary text-md-on-primary hover:brightness-110 active:brightness-90',
        'filled-tonal': 'bg-md-primary-container text-md-on-primary-container hover:brightness-110',
        'outlined':     'bg-transparent border border-md-outline text-md-primary hover:bg-md-primary/8',
        'text':         'bg-transparent text-md-primary hover:bg-md-primary/8 px-3',
        'elevated':     'bg-md-surface-1 text-md-primary elevation-1 hover:elevation-2'
      }

      // backward-compat: map old color prop to filled variant colors
      const legacyColorMap = {
        success: 'bg-success text-white hover:brightness-110',
        warning: 'bg-warning text-white hover:brightness-110',
        error:   'bg-error text-white hover:brightness-110',
        info:    'bg-info text-white hover:brightness-110',
      }

      const variantClass = legacyColorMap[this.color] || variants[this.variant] || variants.filled

      return [...base, variantClass].filter(Boolean).join(' ')
    }
  },
  methods: {
    click(e) { if (!this.disabled && !this.loading) this.$emit('click', e) }
  }
}
</script>
```

**Step 2: Verify build**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app && npm run build 2>&1 | tail -5
EOF
```
Expected: clean.

**Step 3: Commit**
```bash
git add components/ui/Btn.vue
git commit -m "style(Btn): M3 button variants — filled, tonal, outlined, text, elevated"
```

---

### Task 2.2: Rewrite `components/ui/ToggleSwitch.vue` — M3 Switch

**Files:**
- Modify: `components/ui/ToggleSwitch.vue`

**Step 1: Replace with M3 Switch**

M3 switch: 52×32px track, 20px thumb (resting) → 28px thumb (pressed), primary colour when on, surface-variant when off.

```vue
<template>
  <button
    role="switch"
    :aria-checked="String(toggleValue)"
    :disabled="disabled"
    :class="[
      'relative inline-flex shrink-0 cursor-pointer rounded-md-full transition-md-standard',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary',
      disabled ? 'opacity-40 cursor-not-allowed' : '',
      'w-[52px] h-8'
    ]"
    @click="clickToggle"
  >
    <!-- Track -->
    <span :class="[
      'absolute inset-0 rounded-md-full border-2 transition-md-standard',
      toggleValue
        ? 'bg-md-primary border-md-primary'
        : 'bg-transparent border-md-outline'
    ]" />
    <!-- Thumb -->
    <span :class="[
      'absolute top-1/2 -translate-y-1/2 rounded-full transition-md-standard elevation-1',
      toggleValue
        ? 'bg-md-on-primary w-6 h-6 left-[26px]'
        : 'bg-md-outline w-4 h-4 left-[6px]'
    ]" />
  </button>
</template>

<script>
export default {
  model: { prop: 'value', event: 'input' },
  props: {
    value: Boolean,
    disabled: Boolean,
    // kept for backward compat — ignored (M3 always uses primary for on)
    onColor:  { type: String, default: 'success' },
    offColor: { type: String, default: 'primary' }
  },
  computed: {
    toggleValue: {
      get() { return this.value },
      set(v) { this.$emit('input', v) }
    }
  },
  methods: {
    clickToggle() { if (!this.disabled) this.toggleValue = !this.toggleValue }
  }
}
</script>
```

**Step 2: Verify build**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app && npm run build 2>&1 | tail -5
EOF
```

**Step 3: Commit**
```bash
git add components/ui/ToggleSwitch.vue
git commit -m "style(ToggleSwitch): M3 switch — wide track, primary colour, accessible role"
```

---

### Task 2.3: Update `components/ui/TextInput.vue` — M3 outlined field

**Files:**
- Modify: `components/ui/TextInput.vue`
- Modify: `components/ui/TextInputWithLabel.vue`

**Step 1: Update TextInput.vue**

Key changes to the template:
- Container: `relative` div wrapping input
- Input: remove old `bg-${bg}` dynamic class; use `bg-transparent` always with `bg-md-surface-1 rounded-md-sm` on container
- Border: `border border-md-outline rounded-md-sm` → on focus `border-md-primary border-2`
- Add `focus:ring-0 focus:outline-none` to input (outline handled by container border)
- Padding: `px-4 py-3`

Update `inputClass` computed to use M3 tokens:
```js
inputClass() {
  return [
    'w-full bg-transparent text-md-on-surface text-md-body-l',
    'placeholder:text-md-on-surface-variant',
    'focus:outline-none disabled:opacity-40',
    this.prependIcon ? 'pl-10' : 'pl-4',
    this.appendIcon || this.clearable ? 'pr-10' : 'pr-4',
    'py-3'
  ].join(' ')
}
```

Wrap input in a container div:
```html
<div :class="[
  'flex items-center relative rounded-md-sm overflow-hidden',
  'bg-md-surface-1 border transition-md-standard',
  focused ? 'border-md-primary border-2' : 'border-md-outline-variant'
]">
```

Add `focused` data property toggled by `@focus` / `@blur` on the input.

**Step 2: Update TextInputWithLabel.vue**

Update label to use M3 type tokens:
```html
<label class="block text-md-label-l text-md-on-surface-variant mb-1.5">{{ label }}</label>
```

**Step 3: Verify build**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app && npm run build 2>&1 | tail -5
EOF
```

**Step 4: Commit**
```bash
git add components/ui/TextInput.vue components/ui/TextInputWithLabel.vue
git commit -m "style(TextInput): M3 outlined text field with focus indicator"
```

---

### Task 2.4: Update `components/cards/LazyBookCard.vue` — M3 card

**Files:**
- Modify: `components/cards/LazyBookCard.vue`

**Step 1: Update visual styles only — no logic changes**

In the template, find the root card container div (around line 1–10 of template). Update:
- Background: add `bg-md-surface-1` (was transparent/flat)
- Border radius: add `rounded-md-md` (12px)
- Remove `box-shadow-book` skeuomorphic class; replace with `elevation-1`
- Add `transition-md-standard active:bg-md-surface-2`

Find the progress bar element. Update:
- Track background: `bg-md-outline-variant/40`
- Fill: `bg-md-primary rounded-md-full` (was `bg-yellow-400` / conditional coloring)
- Height: `h-1` (4px, was likely 2px — more visible on mobile)

Find series badge / sequence badge. Update:
- `bg-md-surface-4 text-md-on-surface text-md-label-s rounded-md-xs px-1.5 py-0.5`

**Step 2: Verify build**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app && npm run build 2>&1 | tail -5
EOF
```

**Step 3: Commit**
```bash
git add components/cards/LazyBookCard.vue
git commit -m "style(LazyBookCard): M3 card surface, radius, progress bar polish"
```

---

### Task 2.5: Update modal base — M3 bottom sheet style

**Files:**
- Modify: `components/modals/Modal.vue` (or equivalent base modal if it exists — check `components/modals/` for a shared base)

**Step 1: Identify the base modal component**

If `Modal.vue` exists, modify it. If not, identify the most-reused modal wrapper (likely the one used in `layouts/default.vue`'s modal registrations).

Key visual changes:
- Scrim: `bg-black/50` (32% overlay) — was likely heavier
- Panel container: slide up from bottom using a CSS transition
  - Closed state: `translate-y-full opacity-0`
  - Open state: `translate-y-0 opacity-100`
  - Transition: `transition-md-decelerate` when opening, `transition-md-accelerate` when closing
- Panel: `bg-md-surface-3 rounded-t-md-xl` (28px top radius, flat bottom)
- Drag handle: `w-8 h-1 rounded-md-full bg-md-on-surface-variant/40 mx-auto mt-3 mb-2`
- Max height: `max-h-[90vh] overflow-y-auto`

Add a `<transition>` wrapper:
```html
<transition
  enter-active-class="transition-md-decelerate"
  enter-from-class="translate-y-full opacity-0"
  leave-active-class="transition-md-accelerate"
  leave-to-class="translate-y-full opacity-0"
>
```

**Step 2: Verify build**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app && npm run build 2>&1 | tail -5
EOF
```

**Step 3: Commit**
```bash
git add components/modals/
git commit -m "style(modals): M3 bottom sheet — slide-up, drag handle, surface-3, rounded top"
```

---

### Task 2.6: Update `components/widgets/LoadingSpinner.vue` — M3 circular progress

**Files:**
- Modify: `components/widgets/LoadingSpinner.vue`

**Step 1: Replace ball-spin with M3 indeterminate circular progress**

Remove the Load Awesome CSS dependency and replace with a pure CSS SVG spinner:

```vue
<template>
  <svg
    :width="sizePx"
    :height="sizePx"
    viewBox="0 0 48 48"
    class="animate-spin"
    :class="colorClass"
    aria-label="Loading"
    role="status"
  >
    <circle
      cx="24" cy="24" r="20"
      fill="none"
      stroke="currentColor"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      stroke-dasharray="80 45"
    />
  </svg>
</template>

<script>
export default {
  props: {
    size: { type: String, default: 'la-sm' } // kept for compat
  },
  computed: {
    sizePx() {
      const map = { 'la-sm': 24, 'la-lg': 32, 'la-2x': 48, 'la-3x': 64 }
      return map[this.size] ?? 24
    },
    strokeWidth() { return this.sizePx < 32 ? 4 : 3 },
    colorClass() { return 'text-md-primary' }
  }
}
</script>
```

**Step 2: Verify build**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app && npm run build 2>&1 | tail -5
EOF
```

**Step 3: Commit**
```bash
git add components/widgets/LoadingSpinner.vue
git commit -m "style(LoadingSpinner): replace Load Awesome ball-spin with M3 circular progress SVG"
```

---

### Task 2.7: Update `components/home/BookshelfNavBar.vue` — M3 Navigation Bar

**Files:**
- Modify: `components/home/BookshelfNavBar.vue`

**Step 1: Apply M3 navigation bar pattern**

Key visual changes:
- Container: `bg-md-surface-4` (elevated above content)
- Each nav item: `flex flex-col items-center gap-1 py-3 flex-1`
- Active indicator pill: `bg-md-primary-container rounded-md-full px-5 py-1 -mx-1`
  (wraps the icon, not the label)
- Icon: `text-md-on-surface` (inactive) / `text-md-on-primary-container` (active)
- Label: `text-md-label-m` — show for ALL tabs (not just active, which is M3 3-tab style)
- Active label: `text-md-on-surface font-medium` / Inactive: `text-md-on-surface-variant`
- Add `border-t border-md-outline-variant/30` at top of nav bar

**Step 2: Verify build + lint**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app && npm run build 2>&1 | tail -5
EOF
```

**Step 3: Commit**
```bash
git add components/home/BookshelfNavBar.vue
git commit -m "style(BookshelfNavBar): M3 navigation bar — active pill, surface-4, label hierarchy"
```

---

### Task 2.8: Update `components/app/Appbar.vue` — M3 Top App Bar

**Files:**
- Modify: `components/app/Appbar.vue`

**Step 1: Apply M3 top app bar**

Key changes:
- Background: `bg-md-surface-4` (same elevation as nav bar)
- Height: keep existing height (already 64px, which is fine for M3 medium app bar)
- Title: `text-md-title-l text-md-on-surface`
- Icon buttons: `text-md-on-surface-variant hover:text-md-on-surface`
- Add subtle `border-b border-md-outline-variant/20`
- Remove any heavy drop shadows; use border separator instead

**Step 2: Verify build**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app && npm run build 2>&1 | tail -5
EOF
```

**Step 3: Commit**
```bash
git add components/app/Appbar.vue
git commit -m "style(Appbar): M3 top app bar — surface-4, title-l type, border separator"
```

---

## Phase 3 — Screen Deep Dives

### Task 3.1: `pages/connect.vue` — M3 Sign-In page

**Files:**
- Modify: `pages/connect.vue`

**Step 1: Redesign the connect page template**

Key structure changes:
- Outer: full viewport `flex flex-col items-center justify-center min-h-screen bg-md-surface-0 px-6`
- Card: `w-full max-w-sm bg-md-surface-1 rounded-md-xl p-8 elevation-2 flex flex-col gap-6`
- App icon container: `w-20 h-20 rounded-md-xl bg-md-primary-container flex items-center justify-center mx-auto`
- App name: `text-md-headline-s text-md-on-surface text-center`
- Tagline: `text-md-body-m text-md-on-surface-variant text-center -mt-4`
- Server connection form uses M3 text field (TextInputWithLabel, updated in Task 2.3)
- Connect button: `<ui-btn variant="filled" class="w-full">`
- GitHub link: `text-md-label-m text-md-on-surface-variant underline-offset-2 hover:underline`

**Step 2: Verify build**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app && npm run build 2>&1 | tail -5
EOF
```

**Step 3: Commit**
```bash
git add pages/connect.vue
git commit -m "style(connect): M3 sign-in card — centered, surface-1, tonal icon container"
```

---

### Task 3.2: `pages/bookshelf/index.vue` + `LazyBookshelf.vue` — Library grid

**Files:**
- Modify: `pages/bookshelf/index.vue`
- Modify: `components/bookshelf/LazyBookshelf.vue`

**Step 1: Remove wood background, update page-level surface**

In `bookshelf/index.vue`:
- Replace any `bookshelfRow` class usages with `bg-md-surface-0`
- Section header labels: `text-md-label-l text-md-on-surface-variant uppercase tracking-wider px-4 py-2`

In `LazyBookshelf.vue`:
- Container background: `bg-md-surface-0`
- Remove `.bookshelfRow` references
- Card grid gap: `gap-2` (8px — tighter, more modern)

Add empty state (when `totalEntities === 0 && !isFetchingEntities`):
```html
<div v-if="!isFetchingEntities && entities.length === 0" class="flex flex-col items-center justify-center gap-4 py-20 px-8">
  <span class="material-symbols text-6xl text-md-on-surface-variant">auto_stories</span>
  <p class="text-md-headline-s text-md-on-surface text-center">No items yet</p>
  <p class="text-md-body-m text-md-on-surface-variant text-center">Add content to your library to get started.</p>
</div>
```

**Step 2: Verify build**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app && npm run build 2>&1 | tail -5
EOF
```

**Step 3: Commit**
```bash
git add pages/bookshelf/index.vue components/bookshelf/LazyBookshelf.vue
git commit -m "style(bookshelf): remove wood texture, M3 surface-0, tighter grid, empty state"
```

---

### Task 3.3: `components/app/AudioPlayer.vue` — Dynamic colour + M3 Now Playing

**Files:**
- Modify: `components/app/AudioPlayer.vue`

**Step 1: Add dynamic colour extraction**

The component already has `coverRgb` and `coverBgIsLight` data properties and presumably calls `fast-average-color`. Find where cover colour is computed (search for `FastAverageColor` or `fast-average-color` usage in the file). If not present, add it in the `watch` on `playbackSession`:

```js
import { FastAverageColor } from 'fast-average-color'
const fac = new FastAverageColor()

// In watch.playbackSession or a new method getCoverColor():
async getCoverColor(coverSrc) {
  if (!coverSrc) {
    this.$el.style.setProperty('--dynamic-primary', '26 214 145')
    this.$el.style.setProperty('--dynamic-surface', '18 18 18')
    return
  }
  try {
    const color = await fac.getColorAsync(coverSrc)
    // M3 tonal shift: darken for surface, keep vibrant for primary
    const [r, g, b] = color.value
    this.$el.style.setProperty('--dynamic-primary', `${r} ${g} ${b}`)
    // Surface: blend dominant colour at 15% into surface-0
    const sr = Math.round(r * 0.15 + 18 * 0.85)
    const sg = Math.round(g * 0.15 + 18 * 0.85)
    const sb = Math.round(b * 0.15 + 18 * 0.85)
    this.$el.style.setProperty('--dynamic-surface', `${sr} ${sg} ${sb}`)
  } catch (e) {
    // fallback — leave defaults
  }
}
```

**Step 2: Update minimised player bar visual**

Find the minimised player container. Apply:
- Background: `bg-md-surface-4 border-t border-md-outline-variant/20`
- Cover thumbnail: `rounded-md-sm w-12 h-12 object-cover`
- Title: `text-md-title-s text-md-on-surface`
- Author/subtitle: `text-md-label-m text-md-on-surface-variant`
- Play/pause button: `text-md-primary`
- Progress bar (slim bottom edge): `h-0.5 bg-dynamic-primary`

**Step 3: Update expanded (fullscreen) player visual**

Find the fullscreen player container. Apply:
- Outer background: `bg-[rgb(var(--dynamic-surface))]` with `transition-md-emphasized`
  (this is the key dynamic colour moment — background shifts to match cover art)
- Radial gradient overlay for depth:
  `style="background: radial-gradient(ellipse at top, rgb(var(--dynamic-primary), 0.3) 0%, rgb(var(--dynamic-surface)) 60%)"`
- Cover art: `rounded-md-xl elevation-3 mx-auto` (large, prominent)
- Title: `text-md-headline-s text-md-on-surface text-center`
- Author: `text-md-body-l text-md-on-surface-variant text-center`
- Seek bar: keep existing logic, update colours to `accent`/`bg-md-outline`
- Primary play/pause: `w-16 h-16 rounded-md-full bg-md-primary-container text-md-on-primary-container elevation-2 flex items-center justify-center`
- Secondary controls (jump ±15s): `text-md-on-surface-variant`

**Step 4: Verify build**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app && npm run build 2>&1 | tail -5
EOF
```

**Step 5: Commit**
```bash
git add components/app/AudioPlayer.vue
git commit -m "style(AudioPlayer): dynamic cover-art colour, M3 now-playing layout, surface-4 mini bar"
```

---

### Task 3.4: `pages/item/_id/index.vue` — M3 Item Detail

**Files:**
- Modify: `pages/item/_id/index.vue`

**Step 1: Update surface and typography**

Key visual changes:
- Page background: `bg-md-surface-0`
- Hero section (cover + title area):
  - Keep existing `coverRgb` / gradient overlay logic — it already does colour extraction
  - Update gradient: `bg-gradient-to-b from-[rgba(var(--dynamic-surface),0.9)] to-md-surface-0`
- Title: `text-md-headline-m text-md-on-surface`
- Author/narrator: `text-md-title-m text-md-primary`
- Metadata tags (genre, language, etc.): `bg-md-surface-2 text-md-on-surface-variant text-md-label-m px-3 py-1 rounded-md-full`
- Play/Resume button: M3 FAB-style — `w-14 h-14 rounded-md-full bg-md-primary elevation-3 flex items-center justify-center text-md-on-primary`
- Description text: `text-md-body-m text-md-on-surface-variant leading-relaxed`
- Section dividers: `border-t border-md-outline-variant/30`
- Chapter/track rows: `text-md-body-m text-md-on-surface py-3 border-b border-md-outline-variant/20`

**Step 2: Verify build**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app && npm run build 2>&1 | tail -5
EOF
```

**Step 3: Commit**
```bash
git add pages/item/_id/index.vue
git commit -m "style(item-detail): M3 surface hierarchy, FAB play button, type scale, tag pills"
```

---

### Task 3.5: `pages/settings.vue` — M3 Settings

**Files:**
- Modify: `pages/settings.vue`

**Step 1: Update settings page structure**

Key visual changes:
- Page: `bg-md-surface-0`
- Group sections: wrap each settings group in `bg-md-surface-1 rounded-md-lg mx-4 mb-3 overflow-hidden`
- Section headers (Display, Playback, Sleep Timer):
  `text-md-label-l text-md-primary font-medium px-4 pt-5 pb-2 uppercase tracking-wider`
  (these stay outside the card, above each group)
- List tiles (each setting row):
  `flex items-center justify-between px-4 py-3.5 border-b border-md-outline-variant/20 last:border-0`
- Setting label: `text-md-body-l text-md-on-surface`
- Setting subtitle/description (if present): `text-md-body-s text-md-on-surface-variant mt-0.5`
- Toggles: already updated via Task 2.2
- Dropdowns/selects: `text-md-on-surface bg-md-surface-2 rounded-md-sm px-3 py-2 text-md-body-m border border-md-outline-variant`

**Step 2: Verify build + lint**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app && npm run lint 2>&1 | tail -10
cd ~/workspace/audiobookshelf-app && npm run build 2>&1 | tail -5
EOF
```
Expected: lint clean, build clean.

**Step 3: Commit**
```bash
git add pages/settings.vue
git commit -m "style(settings): M3 grouped list tiles, section headers, surface-1 cards"
```

---

## Phase 3 Post — Screenshot After & Push

### Task 3.6: Take post-overhaul screenshots and push

**Step 1: Take new screenshots**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
cd ~/workspace/audiobookshelf-app
npx playwright test scripts/screenshot.js --reporter=line 2>&1
EOF
```
Expected: 5 new PNGs in `docs/screenshots/<new-timestamp>/`.

> **Claude note:** Read each PNG with the Read tool. Compare against baseline screenshots from Task 0.4 and describe the visual improvement.

**Step 2: Build final APK**
```bash
cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash << 'EOF'
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME=$HOME/.android-sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH
cd ~/workspace/audiobookshelf-app
npm run sync
cd android && ./gradlew assembleDebug --no-daemon 2>&1 | /usr/bin/grep -E "error:|BUILD SUCCESS|BUILD FAILED"
EOF
```
Expected: `BUILD SUCCESSFUL`

**Step 3: Push to fork**
```bash
cd ~/workspace/audiobookshelf-app
git push origin master
```

---

## Task Summary

| # | Task | Phase | Key Files |
|---|------|-------|-----------|
| 0.1 | Install Playwright | Visual pipeline | package.json |
| 0.2 | Create mock data | Visual pipeline | mock/db.json |
| 0.3 | Screenshot script | Visual pipeline | scripts/screenshot.js |
| 0.4 | Baseline screenshots | Visual pipeline | docs/screenshots/ |
| 1.1 | M3 CSS tokens | Design system | assets/tailwind.css |
| 1.2 | Tailwind M3 config | Design system | tailwind.config.js |
| 1.3 | Remove wood, M3 shadows | Design system | assets/app.css |
| 2.1 | M3 Btn variants | Components | components/ui/Btn.vue |
| 2.2 | M3 Switch | Components | components/ui/ToggleSwitch.vue |
| 2.3 | M3 Text field | Components | components/ui/TextInput.vue |
| 2.4 | M3 Book card | Components | components/cards/LazyBookCard.vue |
| 2.5 | M3 Bottom sheet | Components | components/modals/Modal.vue |
| 2.6 | M3 Spinner | Components | components/widgets/LoadingSpinner.vue |
| 2.7 | M3 Nav bar | Components | components/home/BookshelfNavBar.vue |
| 2.8 | M3 App bar | Components | components/app/Appbar.vue |
| 3.1 | Connect page | Screen | pages/connect.vue |
| 3.2 | Bookshelf page | Screen | pages/bookshelf/index.vue |
| 3.3 | Now Playing + dynamic colour | Screen | components/app/AudioPlayer.vue |
| 3.4 | Item Detail | Screen | pages/item/_id/index.vue |
| 3.5 | Settings | Screen | pages/settings.vue |
| 3.6 | Post screenshots + APK + push | Wrap-up | — |
