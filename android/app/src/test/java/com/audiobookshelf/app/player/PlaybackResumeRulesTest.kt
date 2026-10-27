package com.audiobookshelf.app.player

import androidx.media3.common.Player
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regression cover for the dead mini player after a cold start.
 *
 * Reported twice: close the app, reopen it, and a mini player is sitting there with no episode
 * title whose play button does nothing at all. The webview restores lastPlaybackSession from the
 * database and shows a player for it, while the service is brand new and holds no session - so
 * play() recovered nothing, ran against a player with no media, and playPause() reported success
 * anyway.
 */
class PlaybackResumeRulesTest {

  /** The cold-start case: a fresh player has no media. */
  @Test
  fun `an empty player needs preparing`() {
    assertTrue(playerNeedsPreparing(Player.STATE_IDLE, 0))
  }

  /** Idle counts even if a media item is somehow still attached. */
  @Test
  fun `an idle player needs preparing`() {
    assertTrue(playerNeedsPreparing(Player.STATE_IDLE, 1))
  }

  /** No media counts even when the state looks healthy. */
  @Test
  fun `a ready player with nothing loaded needs preparing`() {
    assertTrue(playerNeedsPreparing(Player.STATE_READY, 0))
  }

  /** An ordinary pause must not be re-prepared: that would restart the episode. */
  @Test
  fun `a paused player does not need preparing`() {
    assertFalse(playerNeedsPreparing(Player.STATE_READY, 1))
    assertFalse(playerNeedsPreparing(Player.STATE_BUFFERING, 1))
  }

  /** The service's own session is the live truth; the stored record can lag behind it. */
  @Test
  fun `prefers the session the service already holds`() {
    assertEquals("live", sessionToResume("live", "stored"))
  }

  /** The bug: on a cold start this was null, and nothing looked any further. */
  @Test
  fun `falls back to the stored session when the service has none`() {
    assertEquals("stored", sessionToResume(null, "stored"))
  }

  /** Nothing to resume is the one case a play button should honestly report doing nothing. */
  @Test
  fun `has nothing to resume when neither exists`() {
    assertNull(sessionToResume<String>(null, null))
  }

  /** A server session on a fresh process: no connection is selected yet. */
  @Test
  fun `restores the server connection for a server session on a new process`() {
    assertTrue(needsServerConnectionRestored("cfg-1", false, null))
  }

  /** Already connected to the right server - reselecting it would be pointless work. */
  @Test
  fun `leaves the connection alone when it already matches`() {
    assertFalse(needsServerConnectionRestored("cfg-1", false, "cfg-1"))
  }

  /** Connected to a different server than the session came from. */
  @Test
  fun `restores the connection when a different server is selected`() {
    assertTrue(needsServerConnectionRestored("cfg-1", false, "cfg-2"))
  }

  /** A downloaded episode plays off disk and needs no server at all. */
  @Test
  fun `needs no server connection for a local session`() {
    assertFalse(needsServerConnectionRestored("cfg-1", true, null))
  }

  /** A session with no server recorded against it cannot name one to restore. */
  @Test
  fun `needs no server connection when the session names none`() {
    assertFalse(needsServerConnectionRestored(null, false, null))
    assertFalse(needsServerConnectionRestored("", false, null))
  }
}
