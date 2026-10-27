package com.audiobookshelf.app.player

import androidx.media3.common.Player

/**
 * Which session `play()` should prepare, and whether it needs preparing at all.
 *
 * The case these exist for is a cold start. Closing the app and reopening it leaves the webview
 * holding a session - `appStore.init()` restores `lastPlaybackSession` from the database, and the
 * player component replays it, so a mini player appears for it - while the service is brand new
 * and `currentPlaybackSession` is null.
 *
 * `play()` already knew how to recover an unprepared player, but only from
 * `currentPlaybackSession`, so on a cold start it recovered nothing: `currentPlayer.play()` ran
 * against a player with no media, and `playPause()` reported success anyway. The result was a
 * player on screen whose play button did nothing at all.
 *
 * The record was never lost - it just lives in `DeviceManager.deviceData.lastPlaybackSession`
 * until something asks for it.
 */

/**
 * Whether the player has nothing loaded and needs a session prepared before it can play.
 *
 * A player that is merely paused is neither idle nor empty, so this stays false for it and the
 * ordinary `currentPlayer.play()` path is used.
 */
fun playerNeedsPreparing(playbackState: Int, mediaItemCount: Int): Boolean {
  return playbackState == Player.STATE_IDLE || mediaItemCount == 0
}

/**
 * The session to prepare: whatever the service is already holding, else the last one the device
 * recorded.
 *
 * The service's own session wins when it has one - it is the live truth, and the stored record
 * can lag behind it. Null means there is genuinely nothing to resume, which is the one case where
 * a play button should report that it did nothing.
 */
fun <T> sessionToResume(current: T?, lastKnown: T?): T? {
  return current ?: lastKnown
}

/** What resuming a stored session requires. */
enum class ResumeStrategy {
  /** Nothing to resume, and a play button should honestly report doing nothing. */
  NOTHING,
  /** The stored session can be handed straight to the player. */
  PREPARE_STORED,
  /** The stored session names the item, but the server has to be asked for a fresh one. */
  REQUEST_NEW_SESSION
}

/**
 * How a stored session can be resumed, which depends entirely on where its audio lives.
 *
 * A local session's tracks are files on disk and their URLs keep working for as long as the
 * download does. A *server* session's do not: since Audiobookshelf 2.22 a direct-play track is
 * fetched from `/public/session/<session id>/track/<n>`, an address scoped to a playback session
 * the server opened and has long since closed. Preparing that record gets a player full of media
 * items whose every URL 404s - which looks exactly like the app trying to play and no sound
 * arriving, because that is what it is.
 *
 * The item ids in the record are still good, so the server can be asked to open a new session
 * for the same episode. That is what `startNewPlaybackSession` does.
 */
fun resumeStrategy(hasSession: Boolean, sessionIsLocal: Boolean): ResumeStrategy {
  if (!hasSession) return ResumeStrategy.NOTHING
  return if (sessionIsLocal) ResumeStrategy.PREPARE_STORED else ResumeStrategy.REQUEST_NEW_SESSION
}

/**
 * Whether the server connection has to be re-established before this session can be prepared.
 *
 * A session restored from the database carries the id of the server it came from, but a freshly
 * started process has no connection config selected. Preparing a server session without one
 * builds its URLs against nothing. A local session needs no server, so it is left alone.
 */
fun needsServerConnectionRestored(
  sessionConfigId: String?,
  sessionIsLocal: Boolean,
  currentConfigId: String?
): Boolean {
  if (sessionConfigId.isNullOrEmpty()) return false
  if (sessionIsLocal) return false
  return sessionConfigId != currentConfigId
}
