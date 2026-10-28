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

  /** Not on the watch, but reachable right now. Plays over the network, costing battery. */
  STREAMABLE,

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
        isOnline: Boolean,
        hasWifiConfigured: Boolean,
        lastAttemptFailed: Boolean
): DownloadStatus =
        when {
          isDownloaded -> DownloadStatus.READY
          isDownloading -> DownloadStatus.DOWNLOADING
          // Being able to play it now outranks every explanation of why it is not downloaded.
          // Those explanations exist to turn a dead row into something actionable, and a row
          // that will play when tapped is already the most actionable it can be.
          isOnline -> DownloadStatus.STREAMABLE
          // Checked before the failure: a watch with no network to use did not "fail", and
          // telling someone a download failed when they have never set up Wi-Fi sends them
          // looking in the wrong place.
          !hasWifiConfigured -> DownloadStatus.NEEDS_WIFI_SETUP
          lastAttemptFailed -> DownloadStatus.FAILED
          else -> DownloadStatus.WAITING_FOR_WIFI
        }

/** Whether tapping this row will start audio, one way or another. */
fun isPlayable(status: DownloadStatus): Boolean =
        status == DownloadStatus.READY || status == DownloadStatus.STREAMABLE

/**
 * Whether the screen should offer a way into the watch's Wi-Fi settings.
 *
 * Asked of the facts rather than of the row states, which is a change from the first version.
 * Deriving it from the statuses meant that a watch online through the phone - every row
 * streamable - hid the prompt, even though the reason nothing had downloaded was still that no
 * Wi-Fi had ever been set up. Those are different questions and only one of them is about
 * whether audio can play this second.
 *
 * Still only when it is the actual obstacle: offered beside a fully downloaded queue, it is
 * noise that teaches people to ignore it.
 */
fun shouldOfferWifiSetup(hasWifiConfigured: Boolean, anyUndownloaded: Boolean): Boolean =
        !hasWifiConfigured && anyUndownloaded

/**
 * How long ago the phone last reached this watch, in words.
 *
 * Exists because "nothing is happening" is the hardest state to debug from a watch: an empty
 * screen looks the same whether the phone has never sent anything, sent it a week ago, or sent
 * it a moment ago with nothing in the queue. One line of text separates all three.
 *
 * Null when the watch has never heard from the phone at all - the caller says something
 * different for that, because it is the one case with an action attached.
 */
fun describeLastSync(lastSyncedAtMs: Long, nowMs: Long): String? {
  if (lastSyncedAtMs <= 0) return null

  val elapsed = nowMs - lastSyncedAtMs
  val minutes = elapsed / 60_000
  val hours = minutes / 60
  val days = hours / 24

  return when {
    // Also catches a negative elapsed time, which happens when the two clocks disagree or the
    // watch's was just corrected. An explicit guard above this read well and was dead code:
    // removing it changed no test, which is how it was found.
    minutes < 1 -> "Synced just now"
    minutes < 60 -> "Synced ${minutes}m ago"
    hours < 24 -> "Synced ${hours}h ago"
    days == 1L -> "Synced yesterday"
    else -> "Synced ${days}d ago"
  }
}
