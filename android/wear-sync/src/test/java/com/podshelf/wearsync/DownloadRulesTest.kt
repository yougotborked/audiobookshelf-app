package com.podshelf.wearsync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DownloadRulesTest {
  private val MB = 1024L * 1024

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

  private fun cached(id: String, sizeMb: Long = 100) = CachedEpisode(id, sizeMb * MB, 0L)

  // --- what should be here ---

  @Test
  fun `the head of the queue is what should be downloaded`() {
    assertEquals(
            listOf("a", "b", "c"),
            desiredDownloads(queue("a", "b", "c", "d", "e", "f"), target = 3).map { it.episodeId }
    )
  }

  @Test
  fun `a queue shorter than the target wants all of it`() {
    assertEquals(listOf("a", "b"), desiredDownloads(queue("a", "b"), target = 5).map { it.episodeId })
  }

  @Test
  fun `no queue wants nothing`() {
    assertEquals(emptyList<WearQueueEntry>(), desiredDownloads(null))
    assertEquals(emptyList<WearQueueEntry>(), desiredDownloads(queue()))
  }

  @Test
  fun `a target of zero or less wants nothing`() {
    assertEquals(emptyList<WearQueueEntry>(), desiredDownloads(queue("a"), target = 0))
    assertEquals(emptyList<WearQueueEntry>(), desiredDownloads(queue("a"), target = -1))
  }

  // --- what to fetch ---

  @Test
  fun `only what is missing is fetched`() {
    assertEquals(
            listOf("b", "d"),
            episodesToDownload(queue("a", "b", "c", "d"), setOf("a", "c"), target = 4).map {
              it.episodeId
            }
    )
  }

  @Test
  fun `fetching follows queue order, so an interrupted batch still got the top first`() {
    assertEquals(
            listOf("a", "b", "c"),
            episodesToDownload(queue("a", "b", "c"), emptySet(), target = 3).map { it.episodeId }
    )
  }

  @Test
  fun `nothing is fetched when everything wanted is already here`() {
    assertEquals(
            emptyList<WearQueueEntry>(),
            episodesToDownload(queue("a", "b"), setOf("a", "b"), target = 5)
    )
  }

  @Test
  fun `an episode cached but below the target is not re-fetched and not wanted`() {
    val toDownload = episodesToDownload(queue("a", "b", "c"), setOf("c"), target = 2)
    assertEquals(listOf("a", "b"), toDownload.map { it.episodeId })
  }

  // --- what to delete ---

  @Test
  fun `an episode that dropped out of the queue is evicted`() {
    // The phone excludes finished episodes, so leaving the queue is how "already heard" arrives.
    assertEquals(
            listOf("gone"),
            episodesToEvict(listOf(cached("a"), cached("gone")), queue("a"), target = 5)
    )
  }

  @Test
  fun `an episode pushed past the target is evicted`() {
    assertEquals(
            listOf("c"),
            episodesToEvict(listOf(cached("a"), cached("b"), cached("c")), queue("a", "b", "c"), target = 2)
    )
  }

  @Test
  fun `nothing is evicted when everything fits and is wanted`() {
    assertEquals(
            emptyList<String>(),
            episodesToEvict(listOf(cached("a"), cached("b")), queue("a", "b"), target = 5)
    )
  }

  @Test
  fun `everything is evicted when the queue is empty`() {
    assertEquals(
            listOf("a", "b"),
            episodesToEvict(listOf(cached("a"), cached("b")), queue(), target = 5)
    )
  }

  @Test
  fun `over budget evicts from the back of the queue first`() {
    // Three wanted episodes at 100MB each, against a 250MB budget: the last one goes.
    assertEquals(
            listOf("c"),
            episodesToEvict(
                    listOf(cached("a"), cached("b"), cached("c")),
                    queue("a", "b", "c"),
                    target = 5,
                    budgetBytes = 250 * MB
            )
    )
  }

  @Test
  fun `over budget keeps evicting until it fits`() {
    assertEquals(
            listOf("c", "b"),
            episodesToEvict(
                    listOf(cached("a"), cached("b"), cached("c")),
                    queue("a", "b", "c"),
                    target = 5,
                    budgetBytes = 150 * MB
            )
    )
  }

  @Test
  fun `unwanted episodes are freed before any wanted one is touched`() {
    // 100MB wanted plus 500MB unwanted against a 200MB budget. Dropping the unwanted file is
    // enough; the episode someone is about to play must survive.
    assertEquals(
            listOf("stale"),
            episodesToEvict(
                    listOf(cached("a"), cached("stale", sizeMb = 500)),
                    queue("a"),
                    target = 5,
                    budgetBytes = 200 * MB
            )
    )
  }

  @Test
  fun `the next episode to play is the last one evicted`() {
    val evicted =
            episodesToEvict(
                    listOf(cached("a"), cached("b"), cached("c")),
                    queue("a", "b", "c"),
                    target = 5,
                    budgetBytes = 50 * MB
            )
    assertEquals(listOf("c", "b", "a"), evicted)
  }

  @Test
  fun `exactly at budget evicts nothing`() {
    assertEquals(
            emptyList<String>(),
            episodesToEvict(
                    listOf(cached("a"), cached("b")),
                    queue("a", "b"),
                    target = 5,
                    budgetBytes = 200 * MB
            )
    )
  }

  // --- room for one more ---

  @Test
  fun `there is room when the incoming file fits`() {
    assertTrue(hasRoomToDownload(usedBytes = 100 * MB, incomingBytes = 50 * MB, budgetBytes = 200 * MB))
  }

  @Test
  fun `a file that exactly fills the budget still fits`() {
    assertTrue(hasRoomToDownload(usedBytes = 150 * MB, incomingBytes = 50 * MB, budgetBytes = 200 * MB))
  }

  @Test
  fun `there is no room when the incoming file would overflow`() {
    assertFalse(hasRoomToDownload(usedBytes = 150 * MB, incomingBytes = 51 * MB, budgetBytes = 200 * MB))
  }
}

class PlaybackSourceTest {
  // The rule this encodes: a downloaded file wins even on a perfect connection. A watch mid-run
  // has a radio it is trying not to use and a link that drops at every corner, so streaming
  // something already on the device spends battery to get a worse result.
  @Test
  fun `a downloaded episode plays from disk even when online`() {
    assertEquals(PlaybackSource.Downloaded("/data/ep.audio"), playbackSource("/data/ep.audio", isOnline = true))
  }

  @Test
  fun `a downloaded episode plays from disk when offline`() {
    assertEquals(PlaybackSource.Downloaded("/data/ep.audio"), playbackSource("/data/ep.audio", isOnline = false))
  }

  @Test
  fun `an episode that is not downloaded streams when online`() {
    assertEquals(PlaybackSource.Stream, playbackSource(null, isOnline = true))
  }

  @Test
  fun `an episode that is neither downloaded nor reachable is unavailable`() {
    assertEquals(PlaybackSource.Unavailable, playbackSource(null, isOnline = false))
  }

  @Test
  fun `a blank path is not a download`() {
    assertEquals(PlaybackSource.Stream, playbackSource("", isOnline = true))
    assertEquals(PlaybackSource.Unavailable, playbackSource("   ", isOnline = false))
  }
}
