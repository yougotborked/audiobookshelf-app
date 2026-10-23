package com.audiobookshelf.app.player

import androidx.media3.common.Player
import com.google.android.gms.cast.MediaStatus
import org.junit.Assert.assertEquals
import org.junit.Test

class CastPlaybackStateTest {

  // The case the whole extraction is for: no cast session. Several of CastPlayer's update paths
  // keep running while a session is torn down, and one of them used to dereference the remote
  // client with !! - pressing play after a session dropped was an uncaught NPE.
  @Test
  fun `no session reads as idle`() {
    assertEquals(Player.STATE_IDLE, CastPlaybackState.fromCastPlayerState(null))
  }

  @Test
  fun `buffering and loading both read as buffering`() {
    assertEquals(
            Player.STATE_BUFFERING,
            CastPlaybackState.fromCastPlayerState(MediaStatus.PLAYER_STATE_BUFFERING))
    // Previously fell through to IDLE, which told the UI nothing was playing for the whole gap
    // between pressing play and the receiver starting - when a player looks blank.
    assertEquals(
            Player.STATE_BUFFERING,
            CastPlaybackState.fromCastPlayerState(MediaStatus.PLAYER_STATE_LOADING))
  }

  @Test
  fun `playing and paused both read as ready`() {
    assertEquals(
            Player.STATE_READY,
            CastPlaybackState.fromCastPlayerState(MediaStatus.PLAYER_STATE_PLAYING))
    assertEquals(
            Player.STATE_READY,
            CastPlaybackState.fromCastPlayerState(MediaStatus.PLAYER_STATE_PAUSED))
  }

  @Test
  fun `idle and unknown read as idle`() {
    assertEquals(
            Player.STATE_IDLE,
            CastPlaybackState.fromCastPlayerState(MediaStatus.PLAYER_STATE_IDLE))
    assertEquals(
            Player.STATE_IDLE,
            CastPlaybackState.fromCastPlayerState(MediaStatus.PLAYER_STATE_UNKNOWN))
  }

  @Test
  fun `a state this version of the sdk does not know reads as idle`() {
    assertEquals(Player.STATE_IDLE, CastPlaybackState.fromCastPlayerState(99))
  }
}
