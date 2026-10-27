package com.podshelf.wearsync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WearSyncTest {
  private fun session(
          serverAddress: String = "https://abs.example.com",
          token: String = "tok",
          configId: String = "cfg-1"
  ) =
          WearServerSession(
                  serverAddress = serverAddress,
                  token = token,
                  userId = "user-1",
                  serverConnectionConfigId = configId
          )

  private fun entry(
          episodeId: String = "ep-1",
          durationSeconds: Double = 1800.0,
          currentTimeSeconds: Double = 0.0,
          coverPath: String? = "/api/items/li-1/cover"
  ) =
          WearQueueEntry(
                  libraryItemId = "li-1",
                  episodeId = episodeId,
                  title = "An episode",
                  podcastTitle = "A podcast",
                  coverPath = coverPath,
                  durationSeconds = durationSeconds,
                  currentTimeSeconds = currentTimeSeconds
          )

  private fun queue(vararg ids: String, configId: String = "cfg-1", generatedAtMs: Long = 0) =
          WearQueue(
                  generatedAtMs = generatedAtMs,
                  serverConnectionConfigId = configId,
                  entries = ids.map { entry(episodeId = it) }
          )

  // --- round trips ---

  @Test
  fun `session survives a round trip`() {
    val original = session()
    assertEquals(original, WearSync.decodeSession(WearSync.encodeSession(original)))
  }

  @Test
  fun `queue survives a round trip`() {
    val original = queue("a", "b", "c", generatedAtMs = 1_700_000_000_000)
    assertEquals(original, WearSync.decodeQueue(WearSync.encodeQueue(original)))
  }

  @Test
  fun `an unknown field does not fail the decode`() {
    val json =
            """{"serverAddress":"https://x","token":"t","userId":"u",
               "serverConnectionConfigId":"c","somethingNewer":42}"""
    assertEquals("https://x", WearSync.decodeSession(json)?.serverAddress)
  }

  @Test
  fun `malformed and empty payloads decode to null rather than throwing`() {
    assertNull(WearSync.decodeQueue("not json"))
    assertNull(WearSync.decodeQueue(""))
    assertNull(WearSync.decodeQueue(null))
    assertNull(WearSync.decodeSession("{"))
  }

  // --- staleness ---

  @Test
  fun `a queue younger than the window is fresh`() {
    assertFalse(queueIsStale(generatedAtMs = 1_000, nowMs = 1_000 + QUEUE_STALE_AFTER_MS - 1))
  }

  @Test
  fun `a queue at exactly the window is stale`() {
    assertTrue(queueIsStale(generatedAtMs = 1_000, nowMs = 1_000 + QUEUE_STALE_AFTER_MS))
  }

  @Test
  fun `a queue generated in the future is not stale`() {
    assertFalse(queueIsStale(generatedAtMs = 5_000, nowMs = 1_000))
  }

  // --- server match ---

  @Test
  fun `a queue from the current server matches`() {
    assertTrue(queueMatchesSession(queue("a", configId = "cfg-1"), session(configId = "cfg-1")))
  }

  @Test
  fun `a queue from another server does not match`() {
    assertFalse(queueMatchesSession(queue("a", configId = "cfg-1"), session(configId = "cfg-2")))
  }

  @Test
  fun `a missing queue or session does not match`() {
    assertFalse(queueMatchesSession(null, session()))
    assertFalse(queueMatchesSession(queue("a"), null))
  }

  // --- resume position ---

  @Test
  fun `an unstarted entry begins at zero`() {
    assertEquals(0L, resumePositionMs(entry(currentTimeSeconds = 0.0)))
  }

  @Test
  fun `a part-played entry resumes where it was left`() {
    assertEquals(600_000L, resumePositionMs(entry(currentTimeSeconds = 600.0)))
  }

  @Test
  fun `an entry played past its end restarts`() {
    assertEquals(0L, resumePositionMs(entry(durationSeconds = 100.0, currentTimeSeconds = 120.0)))
  }

  @Test
  fun `an entry inside the end threshold restarts`() {
    assertEquals(0L, resumePositionMs(entry(durationSeconds = 100.0, currentTimeSeconds = 96.0)))
  }

  @Test
  fun `an entry just outside the end threshold resumes`() {
    assertEquals(
            94_000L,
            resumePositionMs(entry(durationSeconds = 100.0, currentTimeSeconds = 94.0))
    )
  }

  @Test
  fun `a negative position begins at zero`() {
    assertEquals(0L, resumePositionMs(entry(currentTimeSeconds = -30.0)))
  }

  @Test
  fun `an entry of unknown duration still resumes`() {
    assertEquals(
            300_000L,
            resumePositionMs(entry(durationSeconds = 0.0, currentTimeSeconds = 300.0))
    )
  }

  // --- urls ---

  @Test
  fun `a stream url joins the server address to the content path`() {
    assertEquals(
            "https://abs.example.com/api/items/li-1/file/42?token=tok",
            trackStreamUrl("https://abs.example.com", "/api/items/li-1/file/42", "tok")
    )
  }

  @Test
  fun `a trailing slash on the server address does not double up`() {
    assertEquals(
            "https://abs.example.com/api/x?token=tok",
            trackStreamUrl("https://abs.example.com/", "/api/x", "tok")
    )
  }

  @Test
  fun `a content path without a leading slash still joins cleanly`() {
    assertEquals(
            "https://abs.example.com/api/x?token=tok",
            trackStreamUrl("https://abs.example.com", "api/x", "tok")
    )
  }

  @Test
  fun `a content path that already has a query appends the token`() {
    assertEquals(
            "https://abs.example.com/api/x?ts=1&token=tok",
            trackStreamUrl("https://abs.example.com", "/api/x?ts=1", "tok")
    )
  }

  @Test
  fun `a cover url is built from the entry cover path`() {
    assertEquals(
            "https://abs.example.com/api/items/li-1/cover?token=tok",
            coverUrl(session(), entry())
    )
  }

  @Test
  fun `an entry with no cover has no cover url`() {
    assertNull(coverUrl(session(), entry(coverPath = null)))
    assertNull(coverUrl(session(), entry(coverPath = "  ")))
  }

  // --- advancing ---

  @Test
  fun `nothing playing starts at the head of the queue`() {
    assertEquals("a", entryAfter(queue("a", "b"), null)?.episodeId)
  }

  @Test
  fun `the entry after one in the middle is its successor`() {
    assertEquals("b", entryAfter(queue("a", "b", "c"), "a")?.episodeId)
  }

  @Test
  fun `the entry after the last one is nothing`() {
    assertNull(entryAfter(queue("a", "b"), "b"))
  }

  @Test
  fun `an episode missing from a replaced queue falls back to the head`() {
    assertEquals("a", entryAfter(queue("a", "b"), "gone")?.episodeId)
  }

  @Test
  fun `an empty queue has nothing to play`() {
    assertNull(entryAfter(queue(), null))
    assertNull(entryAfter(queue(), "a"))
  }
}
