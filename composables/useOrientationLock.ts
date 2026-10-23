/**
 * Whether the app's orientation lock still does anything.
 *
 * The app targets SDK 36, and from Android 16 the system ignores orientation, resizability and
 * aspect-ratio restrictions on any display whose smallest width is 600dp or more. That covers
 * the inner screen of a large foldable, where the setting silently stops working: the lock call
 * is made, rejected, and the screen rotates anyway.
 *
 * It still works on a phone and on a foldable's cover screen, so the setting is worth keeping -
 * it just should not claim to apply where it cannot.
 *
 * https://developer.android.com/develop/adaptive-apps/guides/app-orientation-aspect-ratio-resizability
 */
export const ORIENTATION_LOCK_IGNORED_FROM_DP = 600

/**
 * Given the window's smallest side in dp, whether a lock would be honored.
 *
 * An unknown or nonsense measurement assumes it would be: better to offer a control that turns
 * out not to apply than to hide one that would have worked.
 */
export function isOrientationLockHonored(shortestSideDp: number): boolean {
  if (!Number.isFinite(shortestSideDp) || shortestSideDp <= 0) return true
  return shortestSideDp < ORIENTATION_LOCK_IGNORED_FROM_DP
}

/** The window's smallest side, in dp. In an Android webview a CSS pixel is a dp. */
export function windowShortestSideDp(): number {
  if (typeof window === 'undefined') return 0
  return Math.min(window.innerWidth, window.innerHeight)
}
