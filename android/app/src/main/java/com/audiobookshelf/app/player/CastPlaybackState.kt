package com.audiobookshelf.app.player

import androidx.media3.common.Player
import com.google.android.gms.cast.MediaStatus

/**
 * How a Cast receiver's reported state becomes a Media3 playback state.
 *
 * Pulled out of CastPlayer because the case that matters is the one with no receiver at all. The
 * remote client exists only for the life of a cast session - CastPlayer nulls it on both
 * onSessionEnded and onSessionSuspended - while several of the player's update paths keep running
 * as a session is torn down. Those paths have to answer "what state are we in" without a session,
 * and the answer is not interesting enough to be worth a live Cast device to check.
 */
object CastPlaybackState {

  /**
   * Maps a Cast receiver's player state onto a Media3 state.
   *
   * @param castPlayerState one of MediaStatus.PLAYER_STATE_*, or null when there is no session.
   */
  fun fromCastPlayerState(castPlayerState: Int?): Int =
          when (castPlayerState) {
            // LOADING is the receiver fetching the media it was just handed. Treating it as IDLE
            // - which is what fell out of the old `else` branch - tells the UI there is nothing
            // playing during the gap between pressing play and the receiver starting, which is
            // exactly when a player looks blank.
            MediaStatus.PLAYER_STATE_BUFFERING,
            MediaStatus.PLAYER_STATE_LOADING -> Player.STATE_BUFFERING
            MediaStatus.PLAYER_STATE_PLAYING,
            MediaStatus.PLAYER_STATE_PAUSED -> Player.STATE_READY
            // IDLE, UNKNOWN, an unrecognised state, and no session at all.
            else -> Player.STATE_IDLE
          }
}
