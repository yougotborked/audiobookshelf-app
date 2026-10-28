package com.podshelf.wearsync

/**
 * Speeds offered on the watch.
 *
 * A short list, cycled by one button, rather than a slider: a 1.2 inch screen has no room for a
 * precise control and a run is no time to be aiming at one. 2x is the one most people settle on
 * for talk, so the list is weighted around it rather than stopping there.
 */
val PLAYBACK_SPEEDS: List<Float> = listOf(1.0f, 1.25f, 1.5f, 1.75f, 2.0f, 2.5f, 3.0f)

/**
 * The next speed in the cycle.
 *
 * Wraps, so the control is reachable in both directions from one button. A speed that is not in
 * the list - restored from an older build, or set on the phone - lands on the nearest one rather
 * than resetting to 1x, which would silently undo someone's preference.
 */
fun nextPlaybackSpeed(current: Float, speeds: List<Float> = PLAYBACK_SPEEDS): Float {
  if (speeds.isEmpty()) return current
  val index = speeds.indexOfFirst { kotlin.math.abs(it - current) < 0.01f }
  if (index >= 0) return speeds[(index + 1) % speeds.size]

  val nearest = speeds.minByOrNull { kotlin.math.abs(it - current) } ?: return speeds.first()
  val nearestIndex = speeds.indexOf(nearest)
  return speeds[(nearestIndex + 1) % speeds.size]
}

/** How a speed is written on a watch: "2x", not "2.0x". */
fun formatPlaybackSpeed(speed: Float): String {
  val rounded = Math.round(speed * 100) / 100f
  return if (rounded % 1f == 0f) "${rounded.toInt()}x" else "${rounded}x"
}

/**
 * What to play when an episode finishes.
 *
 * Not simply the next entry: the watch only holds the head of the queue, so the one after a
 * finished episode is often not downloaded. Stopping there would end a run early while two
 * perfectly good episodes sat on the device, so this walks forward to the next one that is
 * actually on disk.
 *
 * Forward only. Wrapping to the top would replay something already heard, which on a run means
 * noticing ten minutes later that you have gone backwards.
 */
fun autoAdvanceTarget(
        queue: WearQueue?,
        currentEpisodeId: String?,
        isDownloaded: (String) -> Boolean
): WearQueueEntry? {
  val entries = queue?.entries ?: return null
  if (entries.isEmpty()) return null

  val startIndex =
          if (currentEpisodeId == null) 0
          else {
            val index = entries.indexOfFirst { it.episodeId == currentEpisodeId }
            // An episode that has left the queue - finished and republished while it played -
            // leaves nothing to advance from, so there is nothing safe to pick.
            if (index < 0) return null
            index + 1
          }

  for (i in startIndex until entries.size) {
    if (isDownloaded(entries[i].episodeId)) return entries[i]
  }
  return null
}
