package com.audiobookshelf.app.media

import com.audiobookshelf.app.data.LocalMediaProgress

/**
 * The rules that decide what progress survives when the device and the server disagree.
 *
 * These are the two places where a finished episode was losing its progress:
 *
 *  - Replaying queued playback sessions. Two sessions can exist for the same episode (pressing
 *    play on an item again starts a new one), and the server applies a batch in array order, so
 *    whichever lands last sets the item's progress. They were sent in database order, so an
 *    older session could overwrite a newer one — an episode listened to the end came back at the
 *    position it held the first time around.
 *
 *  - Pulling the server's progress. The server's record is taken wholesale when its lastUpdate is
 *    newer, including an isFinished flag that contradicts the progress next to it. A record of
 *    progress 1.0 with isFinished false would clear a local finished state.
 */
object ProgressSyncRules {

  /**
   * Orders queued sessions so the most recently updated one is sent last, and therefore wins.
   *
   * Every session is kept: the server accumulates timeListening per session, so dropping the
   * older ones for an item would lose listening time. Only the order changes. The sort is stable,
   * so sessions updated at the same moment keep the order they came in.
   */
  fun <T> orderSessionsForReplay(sessions: List<T>, updatedAt: (T) -> Long): List<T> =
          sessions.sortedBy(updatedAt)

  /**
   * Whether an item counts as finished after taking the server's record.
   *
   * The server wins except in one case: it reports the item not finished while its own progress
   * is at or past the finished threshold, and the device already had it finished. That pair is
   * incoherent, and honoring it is how a completed episode reappeared as unplayed.
   *
   * A genuine "mark unplayed" from another device resets progress, so it is well under the
   * threshold and still takes effect.
   */
  fun resolveIsFinished(
          serverIsFinished: Boolean,
          serverProgress: Double,
          localIsFinished: Boolean
  ): Boolean {
    if (serverIsFinished) return true
    if (localIsFinished && serverProgress >= LocalMediaProgress.FINISHED_PROGRESS_THRESHOLD) {
      return true
    }
    return false
  }
}
