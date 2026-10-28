package com.podshelf.wearsync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProgressRulesTest {
  private fun record(
          episodeId: String = "ep-1",
          currentTimeSeconds: Double = 600.0,
          durationSeconds: Double = 1800.0,
          isFinished: Boolean = false,
          updatedAtMs: Long = 2_000
  ) =
          WearProgressRecord(
                  libraryItemId = "li-1",
                  episodeId = episodeId,
                  currentTimeSeconds = currentTimeSeconds,
                  durationSeconds = durationSeconds,
                  isFinished = isFinished,
                  updatedAtMs = updatedAtMs
          )

  private fun queue(vararg pairs: Pair<String, Long>) =
          WearQueue(
                  generatedAtMs = 0,
                  serverConnectionConfigId = "cfg-1",
                  entries =
                          pairs.map { (id, updatedAt) ->
                            WearQueueEntry(
                                    libraryItemId = "li-1",
                                    episodeId = id,
                                    title = "Episode $id",
                                    podcastTitle = "A podcast",
                                    coverPath = null,
                                    durationSeconds = 1800.0,
                                    currentTimeSeconds = 0.0,
                                    progressUpdatedAtMs = updatedAt
                            )
                          }
          )

  // --- finished ---

  @Test
  fun `reaching the stated end is finished`() {
    assertTrue(progressIsFinished(currentTimeSeconds = 1800.0, durationSeconds = 1800.0))
  }

  // Feeds routinely overstate duration by a few seconds of trailing silence, so an episode
  // someone heard all of often stops short of its stated length.
  @Test
  fun `stopping just inside the end is finished`() {
    assertTrue(progressIsFinished(currentTimeSeconds = 1795.0, durationSeconds = 1800.0))
  }

  @Test
  fun `stopping before the threshold is not finished`() {
    assertFalse(progressIsFinished(currentTimeSeconds = 1700.0, durationSeconds = 1800.0))
  }

  @Test
  fun `exactly at the threshold is finished`() {
    assertTrue(
            progressIsFinished(
                    currentTimeSeconds = 1800.0 - FINISHED_REMAINING_SECONDS,
                    durationSeconds = 1800.0
            )
    )
  }

  @Test
  fun `an unknown duration is never finished`() {
    // Guessing "finished" from a position alone would mark an episode heard that nobody heard.
    assertFalse(progressIsFinished(currentTimeSeconds = 5000.0, durationSeconds = 0.0))
  }

  // --- whose position wins ---

  @Test
  fun `a record newer than the phone knows is reported`() {
    assertTrue(shouldReportProgress(record(updatedAtMs = 3_000), lastKnownUpdatedAtMs = 2_000))
  }

  // Someone who kept listening on their phone after the run has a newer position than the
  // watch. Reporting the watch's would wind them backwards.
  @Test
  fun `a record older than the phone knows is not reported`() {
    assertFalse(shouldReportProgress(record(updatedAtMs = 1_000), lastKnownUpdatedAtMs = 2_000))
  }

  @Test
  fun `a record the same age as the phone knows is not reported`() {
    assertFalse(shouldReportProgress(record(updatedAtMs = 2_000), lastKnownUpdatedAtMs = 2_000))
  }

  @Test
  fun `a record for an episode the phone has no progress for is reported`() {
    assertTrue(shouldReportProgress(record(), lastKnownUpdatedAtMs = null))
  }

  @Test
  fun `a record with no timestamp is never reported`() {
    assertFalse(shouldReportProgress(record(updatedAtMs = 0), lastKnownUpdatedAtMs = null))
    assertFalse(shouldReportProgress(record(updatedAtMs = -1), lastKnownUpdatedAtMs = null))
  }

  // The deliberate consequence of deciding by time rather than position: skipping back to
  // re-hear something is a real thing people do, and it must survive the next sync.
  @Test
  fun `a deliberate rewind is reported, because recency decides and not distance`() {
    val rewound = record(currentTimeSeconds = 60.0, updatedAtMs = 5_000)
    assertTrue(shouldReportProgress(rewound, lastKnownUpdatedAtMs = 4_000))
  }

  // --- what to send ---

  @Test
  fun `only records newer than the queue are sent`() {
    val records = listOf(record("a", updatedAtMs = 3_000), record("b", updatedAtMs = 1_000))
    val toSend = reportsToSend(records, queue("a" to 2_000, "b" to 2_000))
    assertEquals(listOf("a"), toSend.map { it.episodeId })
  }

  // Dropping off the queue usually means finished - and that finish may be exactly what this
  // record is carrying.
  @Test
  fun `a record for an episode no longer in the queue is still sent`() {
    val toSend = reportsToSend(listOf(record("gone")), queue("a" to 9_999))
    assertEquals(listOf("gone"), toSend.map { it.episodeId })
  }

  @Test
  fun `everything is sent when there is no queue to compare against`() {
    assertEquals(2, reportsToSend(listOf(record("a"), record("b")), null).size)
  }

  @Test
  fun `nothing to send is nothing to send`() {
    assertEquals(emptyList<WearProgressRecord>(), reportsToSend(emptyList(), queue("a" to 1)))
  }

  // --- merging observations ---

  @Test
  fun `a new episode is added`() {
    val merged = mergeProgressRecord(listOf(record("a")), record("b"))
    assertEquals(setOf("a", "b"), merged.map { it.episodeId }.toSet())
  }

  // Without this a long run accumulates a record per position report and flushes hundreds of
  // writes for one episode.
  @Test
  fun `a newer observation replaces the old one rather than piling up`() {
    val merged =
            mergeProgressRecord(
                    listOf(record("a", currentTimeSeconds = 100.0, updatedAtMs = 1_000)),
                    record("a", currentTimeSeconds = 500.0, updatedAtMs = 2_000)
            )
    assertEquals(1, merged.size)
    assertEquals(500.0, merged.first().currentTimeSeconds, 0.0)
  }

  @Test
  fun `an observation older than the stored one is ignored`() {
    val existing = listOf(record("a", currentTimeSeconds = 500.0, updatedAtMs = 2_000))
    val merged = mergeProgressRecord(existing, record("a", currentTimeSeconds = 100.0, updatedAtMs = 1_000))
    assertEquals(500.0, merged.first().currentTimeSeconds, 0.0)
  }

  @Test
  fun `a record survives a round trip through the stored queue`() {
    val original = WearProgressQueue(listOf(record("a"), record("b")))
    val json = kotlinx.serialization.json.Json.encodeToString(WearProgressQueue.serializer(), original)
    assertEquals(
            original,
            kotlinx.serialization.json.Json.decodeFromString(WearProgressQueue.serializer(), json)
    )
  }
}
