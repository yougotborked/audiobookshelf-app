// Generates the fixed Play Store graphics: the 512x512 listing icon and the 1024x500 feature
// graphic. Both are drawn from the same mark and palette the app uses, so they cannot drift
// from it by being redrawn in a design tool nobody opens again.
//
// Screenshots are not here - those come from the real app via test/e2e/store.spec.ts.
//
//   node scripts/store-assets.mjs        (or: npm run store:assets)

import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'docs', 'store')

// Kept in step with assets/tailwind.css by hand; there are only three, and a build step to share
// them would cost more than it saves.
const AMBER = '#F0B457'
const SURFACE = '#2C2722'
const BASE = '#141210'
const ON_SURFACE = '#ECE4DA'
const ON_SURFACE_VARIANT = '#D0C3B4'

const MARK = `<g fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round">
  <path d="M10.5 31 A21.5 21.5 0 0 1 53.5 31" />
  <rect x="5" y="31" width="11" height="17" rx="5.5" />
  <rect x="48" y="31" width="11" height="17" rx="5.5" />
  <path d="M28 22 H36" /><path d="M25 31 H39" /><path d="M28 40 H36" />
  <path d="M32 40 V51" /><path d="M22 51 H42" />
</g>`

/**
 * Play's listing icon: 512x512, full bleed, square. Play applies its own rounding and shadow, so
 * baking either in here would double it.
 */
function iconHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:512px;height:512px;overflow:hidden}
    .tile{width:512px;height:512px;background:${SURFACE};display:flex;align-items:center;justify-content:center;color:${AMBER}}
  </style></head><body>
    <div class="tile"><svg width="340" height="340" viewBox="0 0 64 64">${MARK}</svg></div>
  </body></html>`
}

/**
 * Feature graphic: 1024x500, shown at the top of the listing and cropped on some surfaces, so
 * everything that matters stays near the middle and nothing load-bearing goes in the corners.
 */
function featureHtml() {
  return `<!doctype html><html><head>
    <meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
    html,body{margin:0;padding:0;width:1024px;height:500px;overflow:hidden}
    .bg{width:1024px;height:500px;background:
      radial-gradient(900px 420px at 78% 50%, rgba(240,180,87,0.16) 0%, rgba(240,180,87,0) 62%),
      linear-gradient(135deg, ${BASE} 0%, ${SURFACE} 100%);
      display:flex;align-items:center;gap:52px;padding:0 84px;box-sizing:border-box;
      font-family:'Source Sans 3',system-ui,sans-serif}
    .mark{color:${AMBER};flex:none;display:flex}
    h1{margin:0;color:${ON_SURFACE};font-size:92px;font-weight:700;letter-spacing:-2px;line-height:1}
    p{margin:14px 0 0;color:${ON_SURFACE_VARIANT};font-size:33px;font-weight:400;line-height:1.3}
  </style></head><body>
    <div class="bg">
      <div class="mark"><svg width="210" height="210" viewBox="0 0 64 64">${MARK}</svg></div>
      <div>
        <h1>Podshelf</h1>
        <p>Catch up on your podcasts.<br/>Your server, your library, offline.</p>
      </div>
    </div>
  </body></html>`
}

const TARGETS = [
  { name: 'icon-512.png', width: 512, height: 512, html: iconHtml() },
  { name: 'feature-graphic-1024x500.png', width: 1024, height: 500, html: featureHtml() }
]

fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}
)

for (const target of TARGETS) {
  const page = await browser.newPage({
    viewport: { width: target.width, height: target.height },
    deviceScaleFactor: 1
  })
  await page.setContent(target.html, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts?.ready)
  await page.screenshot({ path: path.join(OUT, target.name), omitBackground: false })
  await page.close()
  console.log(`${target.name}  ${target.width}x${target.height}`)
}

await browser.close()
console.log(`\nWritten to ${path.relative(ROOT, OUT)}/`)
