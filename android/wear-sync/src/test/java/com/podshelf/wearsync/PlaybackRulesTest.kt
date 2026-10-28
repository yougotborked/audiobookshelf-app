package com.podshelf.wearsync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PlaybackRulesTest {
  private fun queue(vararg ids: String) =
          WearQueue(
                  generatedAtMs = 0,
                  serverConnectionConfigId = "cfg-1",
                  entries =
                          ids.map {
                            WearQueueEntry(
                                    libraryItemId = "li-$it",
                                    episodeId = it,
                                    title = "Episode $it",
                                    podcastTitle = "A podcast",
                                    coverPath = null,
                                    durationSeconds = 1800.0,
                                    currentTimeSeconds = 0.0
                            )
                          }
          )

  // --- speeds ---

  @Test
  fun `the cycle steps through the list`() {
    assertEquals(1.25f, nextPlaybackSpeed(1.0f))
    assertEquals(2.0f, nextPlaybackSpeed(1.75f))
  }

  @Test
  fun `the cycle wraps, so one button reaches everything`() {
    assertEquals(1.0f, nextPlaybackSpeed(3.0f))
  }

  // Resetting to 1x would silently undo a preference set elsewhere or by an older build.
  @Test
  fun `a speed not in the list moves on from its nearest neighbour`() {
    assertEquals(2.0f, nextPlaybackSpeed(1.8f))
    assertEquals(1.25f, nextPlaybackSpeed(0.9f))
  }

  @Test
  fun `an empty list leaves the speed alone`() {
    assertEquals(1.5f, nextPlaybackSpeed(1.5f, emptyList()))
  }

  @Test
  fun `a whole speed loses its decimal`() {
    assertEquals("2x", formatPlaybackSpeed(2.0f))
    assertEquals("1x", formatPlaybackSpeed(1.0f))
  }

  @Test
  fun `a fractional speed keeps it`() {
    assertEquals("1.25x", formatPlaybackSpeed(1.25f))
    assertEquals("1.5x", formatPlaybackSpeed(1.5f))
  }

  // --- advancing ---

  @Test
  fun `the next downloaded episode plays`() {
    val target = autoAdvanceTarget(queue("a", "b", "c"), "a") { true }
    assertEquals("b", target?.episodeId)
  }

  // The watch holds only the head of the queue, so the very next entry is often not on disk.
  // Stopping there ends a run early with good episodes sitting on the device.
  @Test
  fun `an undownloaded episode is skipped rather than ending the run`() {
    val target = autoAdvanceTarget(queue("a", "b", "c"), "a") { it == "c" }
    assertEquals("c", target?.episodeId)
  }

  @Test
  fun `nothing downloaded ahead means nothing to advance to`() {
    assertNull(autoAdvanceTarget(queue("a", "b"), "a") { false })
  }

  @Test
  fun `the last episode has nothing after it`() {
    assertNull(autoAdvanceTarget(queue("a", "b"), "b") { true })
  }

  // Wrapping would replay something already heard, which on a run means noticing ten minutes
  // later that you have gone backwards.
  @Test
  fun `advancing never wraps to the top`() {
    val target = autoAdvanceTarget(queue("a", "b"), "b") { it == "a" }
    assertNull(target)
  }

  @Test
  fun `nothing playing starts at the first downloaded episode`() {
    assertEquals("b", autoAdvanceTarget(queue("a", "b"), null) { it == "b" }?.episodeId)
  }

  // Finished and republished while it played: there is no position to advance from, so picking
  // anything would be a guess.
  @Test
  fun `an episode no longer in the queue gives nothing to advance from`() {
    assertNull(autoAdvanceTarget(queue("a", "b"), "gone") { true })
  }

  @Test
  fun `an empty or missing queue advances to nothing`() {
    assertNull(autoAdvanceTarget(queue(), "a") { true })
    assertNull(autoAdvanceTarget(null, "a") { true })
  }
}
