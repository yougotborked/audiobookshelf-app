import { test } from '@playwright/test'
import { bootApp, expectAppRendered, settle } from './fixtures/app'

/**
 * Phone screenshots for the Play listing.
 *
 * Separate from screens.spec.ts because Play constrains the output in ways design review does
 * not: it wants an aspect ratio inside 1:2..2:1, so the tall 412x915 shots the design pass uses
 * are out of range. 360x640 at a device scale factor of 3 lands exactly on 1080x1920 - a plain
 * 9:16, a real 360dp phone width, and comfortably inside Play's limits.
 *
 * These run with the rest of `npm run screenshots` and write to docs/store/screenshots/, which
 * is committed, unlike docs/screenshots/.
 */

test.use({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 })

const OUT = 'docs/store/screenshots'

const SCREENS = [
  { file: '01-catch-up', path: '/bookshelf' },
  { file: '02-library', path: '/bookshelf/library' },
  { file: '03-search', path: '/search' },
  { file: '04-settings', path: '/settings' }
] as const

for (const screen of SCREENS) {
  test(`store screenshot: ${screen.file}`, async ({ page }) => {
    const booted = await bootApp(page, screen.path, 'phone')
    // bootApp sets its own viewport; put Play's back before the capture.
    await page.setViewportSize({ width: 360, height: 640 })
    await expectAppRendered(page, booted)
    await settle(page)
    await page.screenshot({ path: `${OUT}/${screen.file}.png` })
  })
}
