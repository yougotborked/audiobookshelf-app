package com.podshelf.wearsync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DownloadStatusTest {
  private fun status(
          isDownloaded: Boolean = false,
          isDownloading: Boolean = false,
          isOnline: Boolean = false,
          hasWifiConfigured: Boolean = true,
          lastAttemptFailed: Boolean = false
  ) = downloadStatus(isDownloaded, isDownloading, isOnline, hasWifiConfigured, lastAttemptFailed)

  @Test
  fun `a downloaded episode is ready`() {
    assertEquals(DownloadStatus.READY, status(isDownloaded = true))
  }

  @Test
  fun `being downloaded beats every other state`() {
    // Whatever else is true, the file is here and playable.
    assertEquals(
            DownloadStatus.READY,
            status(isDownloaded = true, isOnline = true, hasWifiConfigured = false, lastAttemptFailed = true)
    )
  }

  @Test
  fun `an episode in flight is downloading`() {
    assertEquals(DownloadStatus.DOWNLOADING, status(isDownloading = true))
  }

  @Test
  fun `an episode simply not fetched yet is waiting`() {
    assertEquals(DownloadStatus.WAITING_FOR_WIFI, status())
  }

  // The dead end this exists to end: with no Wi-Fi ever configured, waiting is not a state that
  // resolves on its own, and saying "Waiting for Wi-Fi" is a lie by omission.
  @Test
  fun `a watch with no Wi-Fi configured needs setup, not patience`() {
    assertEquals(DownloadStatus.NEEDS_WIFI_SETUP, status(hasWifiConfigured = false))
  }

  // Telling someone a download failed when they have never set up Wi-Fi sends them looking in
  // entirely the wrong place.
  @Test
  fun `missing Wi-Fi outranks a failed attempt`() {
    assertEquals(
            DownloadStatus.NEEDS_WIFI_SETUP,
            status(hasWifiConfigured = false, lastAttemptFailed = true)
    )
  }

  @Test
  fun `a failure on a connectable watch is reported as a failure`() {
    assertEquals(DownloadStatus.FAILED, status(lastAttemptFailed = true))
  }

  @Test
  fun `downloading outranks a previous failure`() {
    assertEquals(DownloadStatus.DOWNLOADING, status(isDownloading = true, lastAttemptFailed = true))
  }

  // --- streaming ---

  @Test
  fun `an undownloaded episode on a reachable network can be streamed`() {
    assertEquals(DownloadStatus.STREAMABLE, status(isOnline = true))
  }

  // Being able to play it now outranks every explanation of why it is not downloaded: those
  // explanations exist to turn a dead row into something actionable.
  @Test
  fun `streaming outranks the reasons a download has not happened`() {
    assertEquals(DownloadStatus.STREAMABLE, status(isOnline = true, hasWifiConfigured = false))
    assertEquals(DownloadStatus.STREAMABLE, status(isOnline = true, lastAttemptFailed = true))
  }

  @Test
  fun `a downloaded episode is still played from disk even when online`() {
    // A watch mid-run has a radio it is trying not to use.
    assertEquals(DownloadStatus.READY, status(isDownloaded = true, isOnline = true))
  }

  @Test
  fun `only ready and streamable rows start audio`() {
    assertTrue(isPlayable(DownloadStatus.READY))
    assertTrue(isPlayable(DownloadStatus.STREAMABLE))
    assertFalse(isPlayable(DownloadStatus.WAITING_FOR_WIFI))
    assertFalse(isPlayable(DownloadStatus.NEEDS_WIFI_SETUP))
    assertFalse(isPlayable(DownloadStatus.FAILED))
    assertFalse(isPlayable(DownloadStatus.DOWNLOADING))
  }

  // --- offering the shortcut ---

  @Test
  fun `the Wi-Fi shortcut is offered when nothing has downloaded and something is missing`() {
    assertTrue(shouldOfferWifiSetup(hasWifiConfigured = false, anyUndownloaded = true))
  }

  // The reason this is asked of the facts rather than of the row states: a watch online through
  // the phone shows every row as streamable, and deriving the prompt from those statuses hid it
  // even though no Wi-Fi had ever been set up and nothing could ever download.
  @Test
  fun `being able to stream does not hide the Wi-Fi prompt`() {
    val streamingEverything = status(isOnline = true, hasWifiConfigured = false)
    assertEquals(DownloadStatus.STREAMABLE, streamingEverything)
    assertTrue(shouldOfferWifiSetup(hasWifiConfigured = false, anyUndownloaded = true))
  }

  @Test
  fun `the shortcut is not offered to a watch that downloads fine`() {
    assertFalse(shouldOfferWifiSetup(hasWifiConfigured = true, anyUndownloaded = true))
  }

  @Test
  fun `the shortcut is not offered when everything is already downloaded`() {
    assertFalse(shouldOfferWifiSetup(hasWifiConfigured = false, anyUndownloaded = false))
  }
}

class LastSyncTest {
  private val minute = 60_000L
  private val hour = 60 * minute
  private val day = 24 * hour

  @Test
  fun `a watch that has never synced says nothing`() {
    // The caller has its own line for this, because it is the one case with an action attached.
    assertNull(describeLastSync(lastSyncedAtMs = 0, nowMs = day))
    assertNull(describeLastSync(lastSyncedAtMs = -1, nowMs = day))
  }

  @Test
  fun `a sync within the last minute is just now`() {
    assertEquals("Synced just now", describeLastSync(day, day + 59_000))
  }

  @Test
  fun `minutes are reported in minutes`() {
    assertEquals("Synced 5m ago", describeLastSync(day, day + 5 * minute))
    assertEquals("Synced 59m ago", describeLastSync(day, day + 59 * minute))
  }

  @Test
  fun `an hour rolls over to hours`() {
    assertEquals("Synced 1h ago", describeLastSync(day, day + hour))
    assertEquals("Synced 23h ago", describeLastSync(day, day + 23 * hour))
  }

  @Test
  fun `a day reads as yesterday`() {
    assertEquals("Synced yesterday", describeLastSync(day, day + day))
  }

  @Test
  fun `more than a day counts days`() {
    assertEquals("Synced 3d ago", describeLastSync(day, day + 3 * day))
  }

  // Two devices rarely agree on the time to the second, and a watch whose clock was just
  // corrected should not claim it synced in the future.
  @Test
  fun `a timestamp in the future does not read as negative time`() {
    assertEquals("Synced just now", describeLastSync(day + hour, day))
  }
}
