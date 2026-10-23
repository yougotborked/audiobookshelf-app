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
 *
 * And one place where a downloaded copy drifts from what was actually listened to:
 *
 *  - Streaming an item that is also downloaded. The sync writes the server's record and the
 *    session row, but not the download's own progress row, so that row keeps the position from
 *    the last local play until the next connect-time reconciliation.
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

  /**
   * The on-device progress row a server play should also write through to, if any.
   *
   * Playback streamed from the server does not touch the local progress row belonging to a
   * downloaded copy of the same episode. The rows are reconciled on the next connection to the
   * server, so the drift is usually invisible - but between a streamed play and that
   * reconciliation the download still holds the position from the last local play, and opening
   * the app offline in that window resumes from it.
   *
   * Only a row that already exists is returned. An item that was streamed and never downloaded
   * has no local media to resume, and creating a progress row for it would add an entry to the
   * device's own list for something it cannot play.
   *
   * Matching is on the server's identifiers and the connection the row came from: the same
   * library item id can exist on two different servers, and a row for the whole item is not a
   * row for one of its episodes.
   */
  fun findLocalProgressForServerPlay(
          rows: List<LocalMediaProgress>,
          serverConnectionConfigId: String?,
          libraryItemId: String?,
          episodeId: String?
  ): LocalMediaProgress? {
    if (serverConnectionConfigId.isNullOrEmpty()) return null
    if (libraryItemId.isNullOrEmpty()) return null

    return rows.firstOrNull { row ->
      row.serverConnectionConfigId == serverConnectionConfigId &&
              row.libraryItemId == libraryItemId &&
              // Null and empty both mean "not an episode", and the two spellings are mixed
              // across the database and the session.
              row.episodeId.orEmpty() == episodeId.orEmpty()
    }
  }
}
