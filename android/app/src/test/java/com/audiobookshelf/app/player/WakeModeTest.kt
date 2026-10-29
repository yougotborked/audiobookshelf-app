package com.audiobookshelf.app.player

import androidx.media3.common.C
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class WakeModeTest {

  @Test
  fun `a stream keeps the radio awake as well as the CPU`() {
    // The reported bug: screen off, a few seconds of buffered audio, then silence. WAKE_MODE_LOCAL
    // would not have fixed it - a sleeping Wi-Fi radio starves a stream just as surely as a
    // sleeping CPU does.
    assertEquals(C.WAKE_MODE_NETWORK, wakeModeFor(isLocal = false))
  }

  @Test
  fun `a downloaded file needs the CPU only`() {
    assertEquals(C.WAKE_MODE_LOCAL, wakeModeFor(isLocal = true))
  }

  @Test
  fun `neither case leaves the player with no lock at all`() {
    // C.WAKE_MODE_NONE is the default, and the default is what the bug was.
    assertNotEquals(C.WAKE_MODE_NONE, wakeModeFor(isLocal = true))
    assertNotEquals(C.WAKE_MODE_NONE, wakeModeFor(isLocal = false))
  }

  @Test
  fun `local and streamed do not ask for the same thing`() {
    // Holding the Wi-Fi lock for a file on internal storage costs battery and buys nothing, so
    // the two cases must stay distinct rather than both being set to NETWORK for safety.
    assertNotEquals(wakeModeFor(isLocal = true), wakeModeFor(isLocal = false))
  }
}
