/**
 * The single definition of "finished" for media progress.
 *
 * The app had three, which is why one episode could read differently on different screens:
 *
 *   - the Android local progress record set isFinished at progress >= 0.99
 *   - ItemTableRow and ItemMoreMenuModal treated >= 0.97 as finished for display
 *   - the podcast rows, the Catch up feed, the auto playlist and auto-download looked only at
 *     the isFinished flag, with no threshold at all
 *
 * So an episode a few seconds from the end could show "Finished" in one place, "19 sec left" in
 * another, and still sit in Catch up waiting to be played.
 *
 * The threshold matches the one the native layer writes, so what is shown and what is stored
 * agree. It is computed from progress the device already has, which is what keeps it working
 * offline: nothing here needs the server to have confirmed anything.
 */
export const FINISHED_PROGRESS_THRESHOLD = 0.99

export interface MaybeProgress {
  isFinished?: boolean
  progress?: number
}

/** Whether a progress record counts as finished: the stored flag, or close enough to the end. */
export function isProgressFinished(progress: MaybeProgress | null | undefined): boolean {
  if (!progress) return false
  if (progress.isFinished) return true
  const value = progress.progress
  return typeof value === 'number' && value >= FINISHED_PROGRESS_THRESHOLD
}
