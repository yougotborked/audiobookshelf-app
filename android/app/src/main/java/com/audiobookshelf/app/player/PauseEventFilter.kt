package com.audiobookshelf.app.player

import androidx.media3.common.Player

/**
 * Whether an isPlaying=false event is a passing blip rather than a real pause.
 *
 * Seeking makes the player stop playing for a moment: it drops to STATE_BUFFERING, fills, then
 * carries on. Treating that as a pause would sync progress and tell the UI playback stopped, in
 * the middle of a seek, so it is ignored.
 *
 * The test used to be "not playing and buffering", which also swallowed every genuine pause that
 * happened to land while the player was buffering - and that is exactly when unplugging headphones
 * or walking away from a car tends to land, because the link is degrading as the audio stops. The
 * pause was dropped before it reached the progress syncer or the webview, so the last stretch of
 * listening was never written and the app went on believing it was still playing.
 *
 * playWhenReady separates the two cases. A seek or a rebuffer leaves it true: the player still
 * intends to play once it has data. Everything that genuinely pauses - audio becoming noisy when
 * headphones are pulled or Bluetooth drops, audio focus loss, the transport controls - sets it
 * false.
 */
fun shouldIgnorePauseWhileBuffering(
  isPlaying: Boolean,
  playbackState: Int,
  playWhenReady: Boolean
): Boolean {
  if (isPlaying) return false
  if (playbackState != Player.STATE_BUFFERING) return false
  return playWhenReady
}
