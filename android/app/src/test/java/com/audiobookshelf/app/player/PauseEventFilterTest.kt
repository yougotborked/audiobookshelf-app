package com.audiobookshelf.app.player

import androidx.media3.common.Player
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regression cover for pauses being dropped.
 *
 * Reported: playback appeared to carry on after unplugging headphones or leaving the car, and the
 * listening right before it was never recorded. Both devices do send a pause; the app threw it
 * away whenever the player happened to be buffering at that moment, which is common exactly then,
 * because the link is degrading as the audio stops.
 */
class PauseEventFilterTest {

  /** The case the guard exists for: seeking rebuffers, and still intends to play. */
  @Test
  fun `ignores the buffering blip during a seek`() {
    assertTrue(shouldIgnorePauseWhileBuffering(false, Player.STATE_BUFFERING, true))
  }

  /** The bug: headphones out or Bluetooth dropped while buffering clears playWhenReady. */
  @Test
  fun `does not ignore a real pause that lands while buffering`() {
    assertFalse(shouldIgnorePauseWhileBuffering(false, Player.STATE_BUFFERING, false))
  }

  /** An ordinary pause from the transport controls, player already ready. */
  @Test
  fun `does not ignore a pause while ready`() {
    assertFalse(shouldIgnorePauseWhileBuffering(false, Player.STATE_READY, false))
  }

  /** Buffering with no intent to play and nothing loaded is still not something to swallow. */
  @Test
  fun `does not ignore a pause while idle`() {
    assertFalse(shouldIgnorePauseWhileBuffering(false, Player.STATE_IDLE, false))
  }

  /** Reaching the end of an item is a real stop, not a blip. */
  @Test
  fun `does not ignore a stop at the end of an item`() {
    assertFalse(shouldIgnorePauseWhileBuffering(false, Player.STATE_ENDED, false))
  }

  /** A playing event is never a pause to ignore, whatever the other flags say. */
  @Test
  fun `never ignores a playing event`() {
    assertFalse(shouldIgnorePauseWhileBuffering(true, Player.STATE_BUFFERING, true))
    assertFalse(shouldIgnorePauseWhileBuffering(true, Player.STATE_READY, true))
    assertFalse(shouldIgnorePauseWhileBuffering(true, Player.STATE_BUFFERING, false))
  }
}
