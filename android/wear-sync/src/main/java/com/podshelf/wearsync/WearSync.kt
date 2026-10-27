package com.podshelf.wearsync

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * What the phone tells the watch, and the rules the watch applies to it.
 *
 * The direction matters and is the one real design decision here. "What plays next" is already
 * defined once, in `composables/useListeningQueue.ts`: published-date ordering, the resume-first
 * rule, the `publishedAt: 0` fallback, what counts as finished. Re-deriving any of that in Kotlin
 * for the watch would create a second definition that drifts from the first, and the drift would
 * show up as the watch and the phone disagreeing about which episode is next - the exact bug the
 * extraction into a pure module was meant to end.
 *
 * So the phone resolves the queue and pushes the result. The watch never orders anything; it
 * plays the list it was given, in order. That keeps the watch standalone where it has to be -
 * the queue and the credentials are cached on the watch, so a run does not need the phone in
 * your pocket - without making it a second source of truth.
 */
object WearSync {
  /** Data Layer item path carrying [WearServerSession]. */
  const val PATH_SESSION = "/podshelf/session"

  /** Data Layer item path carrying [WearQueue]. */
  const val PATH_QUEUE = "/podshelf/queue"

  /** The single DataMap key under both paths; the value is the JSON below. */
  const val KEY_PAYLOAD = "payload"

  // ignoreUnknownKeys so a payload from a newer phone build still decodes; the two sides
  // update independently and a watch app is often the older of the pair.
  private val json = Json { ignoreUnknownKeys = true }

  fun encodeSession(session: WearServerSession): String =
          json.encodeToString(WearServerSession.serializer(), session)

  fun encodeQueue(queue: WearQueue): String = json.encodeToString(WearQueue.serializer(), queue)

  /** Null rather than throwing: a payload from an older or newer phone build is not a crash. */
  fun decodeSession(payload: String?): WearServerSession? =
          decode(payload, WearServerSession.serializer())

  fun decodeQueue(payload: String?): WearQueue? = decode(payload, WearQueue.serializer())

  private fun <T> decode(
          payload: String?,
          serializer: kotlinx.serialization.DeserializationStrategy<T>
  ): T? {
    if (payload.isNullOrBlank()) return null
    return try {
      json.decodeFromString(serializer, payload)
    } catch (e: Exception) {
      null
    }
  }
}

/**
 * Enough to talk to the Audiobookshelf server without anyone typing a URL on a watch.
 *
 * The token is the phone's own access token. It is pushed over the Data Layer, which is
 * encrypted between the paired devices, and it is the same credential the phone already holds -
 * the watch gains no access the phone did not have.
 */
@Serializable
data class WearServerSession(
        val serverAddress: String,
        val token: String,
        val userId: String,
        /** Mirrors the phone's connection config id, so a server switch invalidates the queue. */
        val serverConnectionConfigId: String
)

@Serializable
data class WearQueueEntry(
        val libraryItemId: String,
        val episodeId: String,
        val title: String,
        val podcastTitle: String,
        /** Server-relative cover path, or null when the podcast has no cover. */
        val coverPath: String?,
        val durationSeconds: Double,
        /** Where the phone last left this episode, in seconds. */
        val currentTimeSeconds: Double
)

@Serializable
data class WearQueue(
        /** Wall-clock milliseconds on the phone when this queue was resolved. */
        val generatedAtMs: Long,
        val serverConnectionConfigId: String,
        val entries: List<WearQueueEntry>
)

/** How long a pushed queue is worth playing before the watch should ask for a fresh one. */
const val QUEUE_STALE_AFTER_MS: Long = 12L * 60 * 60 * 1000

/**
 * Whether the cached queue is old enough to want replacing.
 *
 * Stale is not unusable - a queue from yesterday is still the right set of episodes, and
 * refusing to play it would defeat the point of caching it - so this only drives a refresh
 * request and a note in the UI.
 */
fun queueIsStale(generatedAtMs: Long, nowMs: Long, staleAfterMs: Long = QUEUE_STALE_AFTER_MS): Boolean =
        nowMs - generatedAtMs >= staleAfterMs

/**
 * Whether a cached queue belongs to the server the watch is currently pointed at.
 *
 * Switching servers on the phone leaves a queue of library item ids that mean nothing on the
 * new one; playing it would 404 every track.
 */
fun queueMatchesSession(queue: WearQueue?, session: WearServerSession?): Boolean {
  if (queue == null || session == null) return false
  return queue.serverConnectionConfigId == session.serverConnectionConfigId
}

/**
 * Where to resume an entry.
 *
 * Two edges, both seen on the phone: a position at or past the end means finished, and starting
 * there would hand the player a zero-length window, so it restarts; a position within the last
 * few seconds is effectively the end too. Negative positions come from bad progress records.
 */
fun resumePositionMs(entry: WearQueueEntry, endThresholdSeconds: Double = 5.0): Long {
  val duration = entry.durationSeconds
  val position = entry.currentTimeSeconds
  if (position <= 0) return 0
  if (duration > 0 && position >= duration - endThresholdSeconds) return 0
  return (position * 1000).toLong()
}

/**
 * The URL the watch streams from.
 *
 * `contentUrl` is whatever the server handed back for the play session, and the token goes on
 * the query string because a media player's own requests do not carry our headers. Built here
 * rather than inline so the trailing-slash case has one home: a server address stored with a
 * slash used to produce `https://host//api/...`, which some reverse proxies reject.
 */
fun trackStreamUrl(serverAddress: String, contentUrl: String, token: String): String {
  val base = serverAddress.trimEnd('/')
  val path = if (contentUrl.startsWith("/")) contentUrl else "/$contentUrl"
  val separator = if (path.contains('?')) "&" else "?"
  return "$base$path${separator}token=$token"
}

/** The cover for an entry, or null when there is nothing to show. */
fun coverUrl(session: WearServerSession, entry: WearQueueEntry): String? {
  val path = entry.coverPath?.takeIf { it.isNotBlank() } ?: return null
  return trackStreamUrl(session.serverAddress, path, session.token)
}

/**
 * The entry after the one that just finished.
 *
 * By id rather than by index: the queue can be replaced by a fresh push while something is
 * playing, and an index into the old list would then advance to an unrelated episode.
 */
fun entryAfter(queue: WearQueue, currentEpisodeId: String?): WearQueueEntry? {
  if (currentEpisodeId == null) return queue.entries.firstOrNull()
  val index = queue.entries.indexOfFirst { it.episodeId == currentEpisodeId }
  if (index < 0) return queue.entries.firstOrNull()
  return queue.entries.getOrNull(index + 1)
}
