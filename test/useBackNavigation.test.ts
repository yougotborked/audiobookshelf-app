import { describe, expect, it } from 'vitest'
import { resolveBackAction } from '~/composables/useBackNavigation'

const open = { isModalOpen: false, showReader: false, playerIsFullscreen: false, canGoBack: true }

// The bug this guards: none of this ran. MainActivity registered a back callback after
// Capacitor's AppPlugin had registered its own, and the dispatcher runs them
// last-registered-first, so back went straight to webView.goBack() — which can navigate off the
// app's first history entry and reload everything, looking like a crash and restart.
describe('resolveBackAction', () => {
  it('navigates back when nothing is covering the page', () => {
    expect(resolveBackAction(open)).toBe('history-back')
  })

  it('confirms before leaving the app when there is nowhere back to go', () => {
    expect(resolveBackAction({ ...open, canGoBack: false })).toBe('confirm-exit')
  })

  it('minimizes the fullscreen player rather than navigating', () => {
    // The reported case: open the player from Catch up, swipe back.
    expect(resolveBackAction({ ...open, playerIsFullscreen: true })).toBe('minimize-player')
  })

  it('minimizes the player rather than leaving the app', () => {
    expect(resolveBackAction({ ...open, playerIsFullscreen: true, canGoBack: false })).toBe('minimize-player')
  })

  it('closes the reader before the player', () => {
    expect(resolveBackAction({ ...open, showReader: true, playerIsFullscreen: true })).toBe('close-ebook')
  })

  it('closes a modal before anything else', () => {
    expect(
      resolveBackAction({ isModalOpen: true, showReader: true, playerIsFullscreen: true, canGoBack: false })
    ).toBe('close-modal')
  })

  it('peels one layer at a time', () => {
    // Each call answers for the state it is given; closing a layer is what changes the next answer.
    expect(resolveBackAction({ ...open, isModalOpen: true, playerIsFullscreen: true })).toBe('close-modal')
    expect(resolveBackAction({ ...open, playerIsFullscreen: true })).toBe('minimize-player')
    expect(resolveBackAction(open)).toBe('history-back')
  })
})
