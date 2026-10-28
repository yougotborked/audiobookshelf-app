package com.podshelf.wearsync

/**
 * What the watch should tell someone about an episode that is not on it yet.
 *
 * Separated out and tested because the failure it covers is silence. Before this, every
 * undownloaded row said "Waiting for Wi-Fi" forever - correct for a watch that will be on Wi-Fi
 * tonight, and a dead end for one that has never had a network configured at all. The user
 * cannot tell those apart, and only one of them is something they can act on.
 */
enum class DownloadStatus {
  /** On the watch. Plays with no radio at all. */
  READY,

  /** Being fetched right now. */
  DOWNLOADING,

  /** Nothing is wrong; the watch simply has not been somewhere it could download. */
  WAITING_FOR_WIFI,

  /** This watch has no Wi-Fi network saved, so waiting will never be enough. */
  NEEDS_WIFI_SETUP,

  /** The server could not be reached or refused. Retried on its own. */
  FAILED
}

/**
 * The state of one episode.
 *
 * `hasEverConnected` is the distinction that matters. A watch that has downloaded before is
 * simply between chances; a watch that never has is asking for something the user has to do.
 * Framed as "ever" rather than "right now" because being off Wi-Fi at this instant is the normal
 * case - the pass runs when the watch gets there - and nagging about it would be noise.
 */
fun downloadStatus(
        isDownloaded: Boolean,
        isDownloading: Boolean,
        hasWifiConfigured: Boolean,
        lastAttemptFailed: Boolean
): DownloadStatus =
        when {
          isDownloaded -> DownloadStatus.READY
          isDownloading -> DownloadStatus.DOWNLOADING
          // Checked before the failure: a watch with no network to use did not "fail", and
          // telling someone a download failed when they have never set up Wi-Fi sends them
          // looking in the wrong place.
          !hasWifiConfigured -> DownloadStatus.NEEDS_WIFI_SETUP
          lastAttemptFailed -> DownloadStatus.FAILED
          else -> DownloadStatus.WAITING_FOR_WIFI
        }

/**
 * Whether the screen should offer a way into the watch's Wi-Fi settings.
 *
 * Only when it is the actual obstacle. An offer to configure Wi-Fi shown next to episodes that
 * are already downloaded teaches people to ignore it.
 */
fun shouldOfferWifiSetup(statuses: Collection<DownloadStatus>): Boolean =
        statuses.any { it == DownloadStatus.NEEDS_WIFI_SETUP }
