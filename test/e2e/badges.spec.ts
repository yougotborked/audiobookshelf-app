import { expect, test } from '@playwright/test'
import { bootApp, expectAppRendered, settle } from './fixtures/app'

/**
 * The badge wall actually opening when a badge is tapped.
 *
 * This exists because the first version did not, in a way no check could see. Modal.vue renders
 * at `opacity-0` and fades in from a `watch` on its model value; a watcher only fires on a
 * change, so a modal mounted with that value already true never runs its show routine and sits
 * on the page completely transparent. The markup was correct, the element was in the DOM and on
 * top, and tapping a badge did nothing at all.
 *
 * Both assertions are kept, and which one fires was worth checking rather than assuming. I
 * expected toBeVisible() to pass on the broken version - it tests display, visibility and box
 * size, not transparency - and for the opacity check to be the one doing the work. Reintroducing
 * the bug showed toBeVisible() failing first. The opacity assertion stays regardless: it is the
 * one that describes the actual failure, and it would catch a variant that renders a laid-out
 * but transparent sheet.
 */
test('tapping a badge opens its detail sheet', async ({ page }) => {
  const booted = await bootApp(page, '/stats', 'phone')
  await expectAppRendered(page, booted)
  await settle(page)

  const badge = page.locator('button:has(.material-symbols)').filter({ hasText: /First Hour|Ten Hours|Opening Credits/ }).first()
  await expect(badge).toBeVisible()
  await badge.click()
  await settle(page)

  const sheet = page.locator('.modal').first()
  await expect(sheet).toBeVisible()

  const opacity = await sheet.evaluate((el) => Number(window.getComputedStyle(el).opacity))
  expect(opacity).toBeGreaterThan(0.5)

  // And it says what the badge actually asks for, which is the whole point of the sheet.
  await expect(page.locator('.modal')).toContainText(/Listen|Finish/)
})
