package com.audiobookshelf.app.player

/**
 * Decides which of two playback-session views describes what the player is actually playing.
 *
 * PlayerNotificationService holds the session it prepared; MediaProgressSyncer holds a clone of
 * it whose currentTime is kept up to date while listening. The syncer's copy is therefore the
 * better one to read - but only while both refer to the same session.
 *
 * When playback moves to another item the syncer has not been handed the new session yet, so its
 * copy belongs to the previous item. Preferring it unconditionally (as the code used to) feeds
 * that stale session straight back into the syncer, which then:
 *   - keeps reporting progress against a session the server has already closed, so every sync
 *     fails for as long as playback continues, and
 *   - reports the *new* item's playhead under the *old* item's id, corrupting its progress and
 *     leaving finished episodes looking unfinished.
 *
 * Pure so it can be tested without a service; see ActiveSessionResolverTest.
 *
 * @param serviceSessionId id of the session the service prepared, or null if none
 * @param syncerSessionId id of the session the progress syncer is tracking, or null if none
 * @return true when the syncer's copy should be preferred over the service's
 */
fun shouldPreferSyncerSession(serviceSessionId: String?, syncerSessionId: String?): Boolean {
  if (syncerSessionId == null) return false
  // Nothing prepared yet: the syncer's copy is all there is
  if (serviceSessionId == null) return true
  return serviceSessionId == syncerSessionId
}
