import { describe, expect, it } from 'vitest'
import { resolveBackAction } from '~/composables/useBackNavigation'

const open = { isModalOpen: false, showReader: false, playerIsFullscreen: false, hasInAppHistory: true }

// The bug this guards: none of this ran. MainActivity registered a back callback after
// Capacitor's AppPlugin had registered its own, and the dispatcher runs them
// last-registered-first, so back went straight to webView.goBack() — which can navigate off the
// app's first history entry and reload everything, looking like a crash and restart.
describe('resolveBackAction', () => {
  it('navigates back when nothing is covering the page', () => {
    expect(resolveBackAction(open)).toBe('history-back')
  })

  it('confirms before leaving the app when there is nowhere back to go', () => {
    expect(resolveBackAction({ ...open, hasInAppHistory: false })).toBe('confirm-exit')
  })

  // The reported case: Catch up starts playback and leaves the mini player up, so nothing is
  // covering the page. Going back from the app's first screen used to pop the webview's own
  // history, which reloads the document - and the player component unmounting with it stopped
  // the audio.
  it('does not navigate off the first screen', () => {
    expect(resolveBackAction({ ...open, hasInAppHistory: false })).not.toBe('history-back')
  })

  it('minimizes the fullscreen player rather than navigating', () => {
    // The reported case: open the player from Catch up, swipe back.
    expect(resolveBackAction({ ...open, playerIsFullscreen: true })).toBe('minimize-player')
  })

  it('minimizes the player rather than leaving the app', () => {
    expect(resolveBackAction({ ...open, playerIsFullscreen: true, hasInAppHistory: false })).toBe('minimize-player')
  })

  it('closes the reader before the player', () => {
    expect(resolveBackAction({ ...open, showReader: true, playerIsFullscreen: true })).toBe('close-ebook')
  })

  it('closes a modal before anything else', () => {
    expect(
      resolveBackAction({ isModalOpen: true, showReader: true, playerIsFullscreen: true, hasInAppHistory: false })
    ).toBe('close-modal')
  })

  it('peels one layer at a time', () => {
    // Each call answers for the state it is given; closing a layer is what changes the next answer.
    expect(resolveBackAction({ ...open, isModalOpen: true, playerIsFullscreen: true })).toBe('close-modal')
    expect(resolveBackAction({ ...open, playerIsFullscreen: true })).toBe('minimize-player')
    expect(resolveBackAction(open)).toBe('history-back')
  })
})
