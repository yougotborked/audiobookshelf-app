import { test } from '@playwright/test'
import { bootApp, expectAppRendered, settle, VIEWPORTS, type ViewportName } from './fixtures/app'

/**
 * Screenshots of the app's main screens, for looking at design changes.
 *
 * Shots are viewport-sized, not fullPage. The shelves windows their rows (useRowWindow), so a
 * fullPage capture stretches the viewport past what was ever rendered and writes out half-built
 * rows below the fold - an image that looks like a layout bug and is not one.
 *
 * These are not visual-regression tests - nothing is compared against a baseline. They exist so
 * a layout or theming change can be seen before it ships, which until now meant installing a
 * debug APK. What they do assert is that the app booted: see expectAppRendered.
 */

const SCREENS = [
  { name: 'connect', path: '/connect', signedIn: false },
  { name: 'home', path: '/bookshelf' },
  { name: 'library', path: '/bookshelf/library' },
  { name: 'search', path: '/search' },
  { name: 'settings', path: '/settings' },
  { name: 'downloads', path: '/downloads' },
  { name: 'stats', path: '/account/stats' }
] as const

const OUT = 'docs/screenshots'

for (const screen of SCREENS) {
  test(`${screen.name} @ phone`, async ({ page }) => {
    const booted = await bootApp(page, screen.path, 'phone')
    await expectAppRendered(page, booted)
    await settle(page)
    await page.screenshot({ path: `${OUT}/phone/${screen.name}.png` })
  })
}

// The widths either side of the 600dp threshold, on the screens where the difference shows.
const RESPONSIVE: { name: string; path: string }[] = [
  { name: 'home', path: '/bookshelf' },
  { name: 'settings', path: '/settings' }
]

for (const screen of RESPONSIVE) {
  for (const viewport of ['foldCover', 'foldOpen', 'foldOpenLandscape'] as ViewportName[]) {
    test(`${screen.name} @ ${viewport} (${VIEWPORTS[viewport].width}px)`, async ({ page }) => {
      const booted = await bootApp(page, screen.path, viewport)
      await expectAppRendered(page, booted)
      await settle(page)
      await page.screenshot({ path: `${OUT}/${viewport}/${screen.name}.png` })
    })
  }
}

// The three themes, so a palette change can be judged in all of them at once.
for (const theme of ['dark', 'black', 'light']) {
  test(`home @ ${theme} theme`, async ({ page }) => {
    const booted = await bootApp(page, '/bookshelf', 'phone')
    await expectAppRendered(page, booted)
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t
    }, theme)
    await settle(page)
    await page.screenshot({ path: `${OUT}/themes/home-${theme}.png` })
  })
}
