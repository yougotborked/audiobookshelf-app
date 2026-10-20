package com.audiobookshelf.app.media

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProgressSyncRulesTest {

  private data class Session(val id: String, val item: String, val updatedAt: Long)

  // The reported failure: an episode listened to the end came back at the position it held the
  // first time it was played, because an older queued session for the same item was replayed last.
  @Test
  fun `the newest session for an item is replayed last`() {
    val newest = Session("finished-run", "the-daily-ep", 1_792_389_000_000)
    val older = Session("first-run", "the-daily-ep", 1_792_375_000_000)

    val ordered = ProgressSyncRules.orderSessionsForReplay(listOf(newest, older)) { it.updatedAt }

    assertEquals(listOf(older, newest), ordered)
  }

  @Test
  fun `every session is kept so listening time is not lost`() {
    val sessions = listOf(
            Session("c", "ep-1", 30),
            Session("a", "ep-1", 10),
            Session("b", "ep-2", 20)
    )

    val ordered = ProgressSyncRules.orderSessionsForReplay(sessions) { it.updatedAt }

    assertEquals(sessions.size, ordered.size)
    assertEquals(sessions.toSet(), ordered.toSet())
  }

  @Test
  fun `sessions updated at the same moment keep their original order`() {
    val first = Session("first", "ep-1", 100)
    val second = Session("second", "ep-1", 100)

    val ordered = ProgressSyncRules.orderSessionsForReplay(listOf(first, second)) { it.updatedAt }

    assertEquals(listOf(first, second), ordered)
  }

  @Test
  fun `an empty queue orders to nothing`() {
    assertEquals(emptyList<Session>(), ProgressSyncRules.orderSessionsForReplay(emptyList<Session>()) { it.updatedAt })
  }

  // The second half of the reported failure: the pull wrote isFinished=false over a local finished
  // state while the server's own progress read 1.0.
  @Test
  fun `a finished item is not un-finished by a server record that is itself at the end`() {
    assertTrue(ProgressSyncRules.resolveIsFinished(serverIsFinished = false, serverProgress = 1.0, localIsFinished = true))
  }

  @Test
  fun `a finished item is not un-finished at the threshold`() {
    assertTrue(ProgressSyncRules.resolveIsFinished(false, 0.99, localIsFinished = true))
  }

  @Test
  fun `marking an item unplayed elsewhere still takes effect`() {
    // The server resets progress when an item is marked unplayed, so it is far from the end.
    assertFalse(ProgressSyncRules.resolveIsFinished(false, 0.0, localIsFinished = true))
    assertFalse(ProgressSyncRules.resolveIsFinished(false, 0.0357, localIsFinished = true))
  }

  @Test
  fun `a part-played item is not promoted to finished`() {
    assertFalse(ProgressSyncRules.resolveIsFinished(false, 0.48, localIsFinished = true))
    assertFalse(ProgressSyncRules.resolveIsFinished(false, 0.81, localIsFinished = true))
  }

  @Test
  fun `the server marking an item finished is always taken`() {
    assertTrue(ProgressSyncRules.resolveIsFinished(true, 1.0, localIsFinished = false))
    assertTrue(ProgressSyncRules.resolveIsFinished(true, 0.2, localIsFinished = false))
  }

  @Test
  fun `an item the device never finished is left alone`() {
    assertFalse(ProgressSyncRules.resolveIsFinished(false, 1.0, localIsFinished = false))
    assertFalse(ProgressSyncRules.resolveIsFinished(false, 0.5, localIsFinished = false))
  }
}
