package com.podshelf.wearsync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DownloadStatusTest {
  private fun status(
          isDownloaded: Boolean = false,
          isDownloading: Boolean = false,
          hasWifiConfigured: Boolean = true,
          lastAttemptFailed: Boolean = false
  ) = downloadStatus(isDownloaded, isDownloading, hasWifiConfigured, lastAttemptFailed)

  @Test
  fun `a downloaded episode is ready`() {
    assertEquals(DownloadStatus.READY, status(isDownloaded = true))
  }

  @Test
  fun `being downloaded beats every other state`() {
    // Whatever else is true, the file is here and playable.
    assertEquals(
            DownloadStatus.READY,
            status(isDownloaded = true, hasWifiConfigured = false, lastAttemptFailed = true)
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

  // --- offering the shortcut ---

  @Test
  fun `the Wi-Fi shortcut is offered when something needs it`() {
    assertTrue(
            shouldOfferWifiSetup(listOf(DownloadStatus.READY, DownloadStatus.NEEDS_WIFI_SETUP))
    )
  }

  @Test
  fun `the shortcut is not offered when nothing needs it`() {
    assertFalse(
            shouldOfferWifiSetup(
                    listOf(DownloadStatus.READY, DownloadStatus.WAITING_FOR_WIFI, DownloadStatus.FAILED)
            )
    )
  }

  @Test
  fun `an empty queue offers nothing`() {
    assertFalse(shouldOfferWifiSetup(emptyList()))
  }
}
