package com.podshelf.wearsync

import kotlinx.serialization.Serializable

/**
 * Progress made on the watch, and the rules for reporting it.
 *
 * It goes to the Audiobookshelf server, not back through the phone. The server is already where
 * two devices reconcile - that is how the phone and the web client have always agreed - and
 * routing it through the phone would invent a second merge point that only exists for the watch,
 * with its own ordering bugs to find. The phone picks the watch's listening up on its next
 * refresh, the same way it picks up anything done elsewhere.
 *
 * The watch is offline for most of a run, so records are kept on disk and flushed when a network
 * appears. Any network will do - this is a few hundred bytes, so the Bluetooth proxy through the
 * phone is perfectly good, unlike a download.
 */
@Serializable
data class WearProgressRecord(
        val libraryItemId: String,
        val episodeId: String,
        val currentTimeSeconds: Double,
        val durationSeconds: Double,
        val isFinished: Boolean,
        /** When the listening happened, in wall-clock milliseconds on the watch. */
        val updatedAtMs: Long
)

@Serializable data class WearProgressQueue(val records: List<WearProgressRecord> = emptyList())

/**
 * How close to the end counts as finished.
 *
 * Podcast feeds routinely overstate duration by a few seconds of trailing silence, so an episode
 * someone listened to the end of often stops short of its stated length. Requiring the exact end
 * would leave those sitting in the queue forever.
 */
const val FINISHED_REMAINING_SECONDS: Double = 10.0

fun progressIsFinished(
        currentTimeSeconds: Double,
        durationSeconds: Double,
        remainingThresholdSeconds: Double = FINISHED_REMAINING_SECONDS
): Boolean {
  if (durationSeconds <= 0) return false
  return currentTimeSeconds >= durationSeconds - remainingThresholdSeconds
}

/**
 * Whether the watch's record should overwrite what the server has.
 *
 * This is the "whose position wins" decision, and it is decided by *when*, not by *where*.
 * Furthest-along would be wrong: deliberately skipping back to re-hear something is a real
 * thing people do, and treating it as stale would undo it on the next sync.
 *
 * `lastKnownUpdatedAtMs` is what the phone said when it last published the queue. A watch record
 * older than that means the phone has since heard something newer - someone carried on listening
 * on their phone after the run - and reporting it would wind their position backwards.
 *
 * Ties lose. A record with the same timestamp carries no new information, and reporting it
 * would mean sending the same write every time a network appeared.
 */
fun shouldReportProgress(record: WearProgressRecord, lastKnownUpdatedAtMs: Long?): Boolean {
  if (record.updatedAtMs <= 0) return false
  if (lastKnownUpdatedAtMs == null) return true
  return record.updatedAtMs > lastKnownUpdatedAtMs
}

/**
 * The records worth sending, given what the phone last told us.
 *
 * An episode the queue no longer mentions is still reported: dropping off the queue usually
 * means it was finished, and that finish may well be the very thing this record is carrying.
 */
fun reportsToSend(records: List<WearProgressRecord>, queue: WearQueue?): List<WearProgressRecord> {
  val lastKnown =
          queue?.entries?.associate { it.episodeId to it.progressUpdatedAtMs } ?: emptyMap()
  return records.filter { shouldReportProgress(it, lastKnown[it.episodeId]) }
}

/**
 * Folds a new observation into what is already stored.
 *
 * One record per episode, newest wins. Without this, a long run would accumulate a record for
 * every position report and flush hundreds of writes for the same episode.
 */
fun mergeProgressRecord(
        existing: List<WearProgressRecord>,
        incoming: WearProgressRecord
): List<WearProgressRecord> {
  val previous = existing.firstOrNull { it.episodeId == incoming.episodeId }
  if (previous != null && previous.updatedAtMs > incoming.updatedAtMs) return existing
  return existing.filterNot { it.episodeId == incoming.episodeId } + incoming
}
