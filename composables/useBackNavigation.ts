/**
 * What the Android back gesture does.
 *
 * Back is layered: a modal sits over the reader, the reader over the fullscreen player, and all
 * of them over ordinary navigation. Back should peel off the topmost layer rather than navigate,
 * and only fall through to history once nothing is covering the page.
 *
 * This lived inline in the backButton listener, which never ran: MainActivity registered its own
 * OnBackPressedCallback after Capacitor's AppPlugin had registered its own, and the dispatcher
 * runs them last-registered-first. So back went straight to webView.goBack() and could navigate
 * off the app's first history entry, reloading the whole app - which looks exactly like a crash
 * and restart.
 */
export type BackAction = 'close-modal' | 'close-ebook' | 'minimize-player' | 'history-back' | 'confirm-exit'

export interface BackNavigationContext {
  isModalOpen: boolean
  showReader: boolean
  playerIsFullscreen: boolean
  canGoBack: boolean
}

/** The single thing back should do, given what is currently open. */
export function resolveBackAction({ isModalOpen, showReader, playerIsFullscreen, canGoBack }: BackNavigationContext): BackAction {
  if (isModalOpen) return 'close-modal'
  if (showReader) return 'close-ebook'
  if (playerIsFullscreen) return 'minimize-player'
  // Nothing is covering the page, so this is ordinary navigation - and with nowhere left to go
  // back to, back means leaving the app, which is worth confirming rather than doing silently.
  return canGoBack ? 'history-back' : 'confirm-exit'
}
