package com.podshelf.wearsync

/**
 * What the watch keeps on disk, and what it throws away.
 *
 * Separate from the queue rules because this is the watch's own decision - the phone has no idea
 * how much room the watch has - but it is the same kind of rule: a policy that is wrong in ways
 * nobody notices until a run starts with nothing downloaded. Pure, so it can be.
 */

/** An episode already on the watch. */
data class CachedEpisode(val episodeId: String, val sizeBytes: Long, val downloadedAtMs: Long)

/**
 * How many episodes from the head of the queue to keep ready.
 *
 * Enough for a long run without trying to mirror the phone. Episodes are large and a watch's
 * storage is shared with watch faces, tiles and whatever else, so this is a number to be modest
 * about: five hour-long episodes is already most of a gigabyte.
 */
const val WATCH_DOWNLOAD_TARGET: Int = 5

/** Hard ceiling on what Podshelf will occupy, whatever the target works out to. */
const val WATCH_STORAGE_BUDGET_BYTES: Long = 1_500L * 1024 * 1024

/**
 * The episodes that should be on the watch: the head of the queue, nothing further.
 *
 * Head rather than "everything unfinished" because the queue is already in the order the phone
 * decided things should be heard, and a run starts at the top of it.
 */
fun desiredDownloads(queue: WearQueue?, target: Int = WATCH_DOWNLOAD_TARGET): List<WearQueueEntry> {
  if (queue == null || target <= 0) return emptyList()
  return queue.entries.take(target)
}

/**
 * What to fetch, in the order to fetch it.
 *
 * Queue order, not size order: the first episode matters most, because someone who starts a run
 * before the batch finishes gets whatever arrived first.
 */
fun episodesToDownload(
        queue: WearQueue?,
        cached: Set<String>,
        target: Int = WATCH_DOWNLOAD_TARGET
): List<WearQueueEntry> = desiredDownloads(queue, target).filterNot { cached.contains(it.episodeId) }

/**
 * What to delete.
 *
 * Two reasons, in order. Anything no longer wanted - finished, or pushed off the head of the
 * queue - goes first, because it is free to lose. Only if the rest still will not fit does this
 * start dropping wanted episodes, and then from the back of the queue, so the next thing to play
 * is the last thing to go.
 *
 * An episode the watch holds that is not in the queue at all is also dropped: the phone excludes
 * finished episodes, so vanishing from the queue is how "you already heard this" arrives.
 */
fun episodesToEvict(
        cached: List<CachedEpisode>,
        queue: WearQueue?,
        target: Int = WATCH_DOWNLOAD_TARGET,
        budgetBytes: Long = WATCH_STORAGE_BUDGET_BYTES
): List<String> {
  val wanted = desiredDownloads(queue, target).map { it.episodeId }
  val wantedRank = wanted.withIndex().associate { (index, id) -> id to index }

  val unwanted = cached.filter { !wantedRank.containsKey(it.episodeId) }
  val evicted = unwanted.map { it.episodeId }.toMutableList()

  var remaining = cached.filter { wantedRank.containsKey(it.episodeId) }.sumOf { it.sizeBytes }
  if (remaining <= budgetBytes) return evicted

  // Furthest down the queue first: the next thing to play is the last thing to go.
  val keptByQueueOrder =
          cached.filter { wantedRank.containsKey(it.episodeId) }
                  .sortedByDescending { wantedRank.getValue(it.episodeId) }

  for (episode in keptByQueueOrder) {
    if (remaining <= budgetBytes) break
    evicted.add(episode.episodeId)
    remaining -= episode.sizeBytes
  }

  return evicted
}

/**
 * Whether there is room to start another download.
 *
 * Checked before each fetch rather than once per batch: sizes are not known until a file
 * arrives, so a batch that looked like it fit can stop fitting halfway through.
 */
fun hasRoomToDownload(
        usedBytes: Long,
        incomingBytes: Long,
        budgetBytes: Long = WATCH_STORAGE_BUDGET_BYTES
): Boolean = usedBytes + incomingBytes <= budgetBytes

/** Where an episode's audio comes from. */
sealed interface PlaybackSource {
  /** A file on the watch. Plays with no radio at all. */
  data class Downloaded(val path: String) : PlaybackSource

  /** Needs the server. Only an option when the watch has a usable connection. */
  data object Stream : PlaybackSource

  /** Not downloaded and not reachable: say so rather than starting a player that cannot play. */
  data object Unavailable : PlaybackSource
}

/**
 * How to play an episode.
 *
 * Downloaded always wins, even with a perfect connection. A watch on a run has a radio it is
 * trying not to use and a connection that comes and goes with every corner; streaming a file
 * that is already on the device would spend battery to produce a worse result.
 */
fun playbackSource(downloadedPath: String?, isOnline: Boolean): PlaybackSource =
        when {
          !downloadedPath.isNullOrBlank() -> PlaybackSource.Downloaded(downloadedPath)
          isOnline -> PlaybackSource.Stream
          else -> PlaybackSource.Unavailable
        }

/**
 * Below this, a network is too slow to pull an episode over in a reasonable time.
 *
 * A watch paired over Bluetooth gets its internet proxied through the phone, and that link
 * measures in the hundreds of kbps - fine for a JSON request, hopeless for fifty megabytes. Wi-Fi
 * and LTE report thousands. At 1.5 Mbps a fifty megabyte episode takes about four minutes, which
 * is the slowest worth starting.
 */
const val BULK_DOWNLOAD_MIN_KBPS: Int = 1_500

/**
 * Whether a network is worth downloading an episode over.
 *
 * Capability rather than transport, which is the whole point: Wear OS routes over Bluetooth,
 * Wi-Fi or LTE and swaps between them without telling the app. What matters is not which one it
 * picked but whether it is fast enough and whether it costs the user money.
 *
 * Unknown bandwidth - some networks report 0 - counts as fast enough. Refusing to download over
 * a network that simply declines to describe itself would mean never downloading on the devices
 * that do that, and a slow transfer is a better failure than no transfer.
 */
fun suitableForBulkDownload(
        isMetered: Boolean,
        downstreamBandwidthKbps: Int,
        minimumKbps: Int = BULK_DOWNLOAD_MIN_KBPS
): Boolean {
  if (isMetered) return false
  if (downstreamBandwidthKbps <= 0) return true
  return downstreamBandwidthKbps >= minimumKbps
}
