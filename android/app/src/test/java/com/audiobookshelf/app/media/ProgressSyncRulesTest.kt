package com.audiobookshelf.app.media

import com.audiobookshelf.app.data.LocalMediaProgress
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertSame
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

  // ── findLocalProgressForServerPlay ──
  //
  // A streamed play has to update the downloaded copy's own progress row, or that row keeps the
  // position from the last local play until the next connect-time reconciliation - and the app
  // opened offline in between resumes from it.

  private fun localRow(
          id: String,
          configId: String? = "srv-home",
          libraryItemId: String? = "li_daily",
          episodeId: String? = null
  ) = LocalMediaProgress(
          id = id,
          localLibraryItemId = "local_$id",
          localEpisodeId = null,
          duration = 1800.0,
          progress = 0.25,
          currentTime = 450.0,
          isFinished = false,
          ebookLocation = null,
          ebookProgress = null,
          lastUpdate = 1_792_000_000_000,
          startedAt = 1_791_000_000_000,
          finishedAt = null,
          serverConnectionConfigId = configId,
          serverAddress = "https://abs.example",
          serverUserId = "usr_1",
          libraryItemId = libraryItemId,
          episodeId = episodeId
  )

  @Test
  fun `streaming an episode that is also downloaded finds its local row`() {
    val row = localRow("downloaded-ep", episodeId = "ep_1")

    val found =
            ProgressSyncRules.findLocalProgressForServerPlay(
                    listOf(localRow("other", libraryItemId = "li_other"), row),
                    "srv-home",
                    "li_daily",
                    "ep_1"
            )

    assertSame(row, found)
  }

  @Test
  fun `streaming an item that was never downloaded finds nothing`() {
    val found =
            ProgressSyncRules.findLocalProgressForServerPlay(
                    listOf(localRow("some-other-download", libraryItemId = "li_other")),
                    "srv-home",
                    "li_daily",
                    "ep_1"
            )

    // Not "create one": an item with no local media cannot be resumed offline, and a row for it
    // would show up in the device's own list as something it cannot play.
    assertNull(found)
  }

  @Test
  fun `a row for the whole item is not a row for one of its episodes`() {
    val wholeItem = localRow("book-download", episodeId = null)

    assertNull(
            ProgressSyncRules.findLocalProgressForServerPlay(
                    listOf(wholeItem), "srv-home", "li_daily", "ep_1"))
    assertSame(
            wholeItem,
            ProgressSyncRules.findLocalProgressForServerPlay(
                    listOf(wholeItem), "srv-home", "li_daily", null))
  }

  @Test
  fun `an empty episode id means the same as no episode id`() {
    val wholeItem = localRow("book-download", episodeId = "")

    assertSame(
            wholeItem,
            ProgressSyncRules.findLocalProgressForServerPlay(
                    listOf(wholeItem), "srv-home", "li_daily", null))
  }

  @Test
  fun `the same library item id on another server is not a match`() {
    val otherServer = localRow("from-other-server", configId = "srv-work")

    assertNull(
            ProgressSyncRules.findLocalProgressForServerPlay(
                    listOf(otherServer), "srv-home", "li_daily", null))
  }

  @Test
  fun `a session with no server identity matches nothing`() {
    val rows = listOf(localRow("downloaded"))

    assertNull(ProgressSyncRules.findLocalProgressForServerPlay(rows, null, "li_daily", null))
    assertNull(ProgressSyncRules.findLocalProgressForServerPlay(rows, "", "li_daily", null))
    assertNull(ProgressSyncRules.findLocalProgressForServerPlay(rows, "srv-home", null, null))
    assertNull(ProgressSyncRules.findLocalProgressForServerPlay(rows, "srv-home", "", null))
  }
}
