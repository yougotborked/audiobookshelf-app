package com.audiobookshelf.app.player

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regression cover for the stale-playback-session bug.
 *
 * Observed in the wild: playback moved from one episode to the next, but the progress syncer kept
 * the previous episode's session. Every sync to the server failed for ten minutes straight, and
 * the new episode's playhead was written against the old episode's id - which is how episodes
 * that had been marked finished came back showing a negative time remaining.
 */
class ActiveSessionResolverTest {

  /** Same session on both sides: the syncer's clone carries the live currentTime, so prefer it. */
  @Test
  fun `prefers syncer copy when it is the same session`() {
    assertTrue(shouldPreferSyncerSession("session-a", "session-a"))
  }

  /** The bug: playback advanced, the syncer has not caught up, its copy is the wrong item. */
  @Test
  fun `rejects syncer copy once playback has moved to another session`() {
    assertFalse(shouldPreferSyncerSession("session-b", "session-a"))
  }

  /** Nothing prepared yet - the syncer's copy is the only thing available. */
  @Test
  fun `falls back to syncer copy when the service has no session`() {
    assertTrue(shouldPreferSyncerSession(null, "session-a"))
  }

  /** Syncer idle: there is nothing to prefer. */
  @Test
  fun `rejects syncer copy when the syncer has no session`() {
    assertFalse(shouldPreferSyncerSession("session-a", null))
  }

  /** Both empty: still nothing to prefer, and must not claim otherwise. */
  @Test
  fun `rejects syncer copy when neither side has a session`() {
    assertFalse(shouldPreferSyncerSession(null, null))
  }
}
