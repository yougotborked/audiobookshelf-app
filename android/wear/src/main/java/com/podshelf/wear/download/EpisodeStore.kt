package com.podshelf.wear.download

import android.content.Context
import com.podshelf.wearsync.CachedEpisode
import java.io.File

/**
 * The downloaded episodes on disk.
 *
 * Files in the app's own directory, named by episode id, with no database. There is one fact to
 * know about each - is it here, and how big - and the filesystem already stores both. A database
 * would add a second source of truth that can disagree with the files, which is how a cache
 * ends up confidently reporting an episode it no longer has.
 */
class EpisodeStore(context: Context) {
  private val dir = File(context.filesDir, "episodes").apply { mkdirs() }

  fun fileFor(episodeId: String): File = File(dir, "$episodeId.audio")

  /** A partial download, kept apart so an interrupted fetch is never mistaken for a finished one. */
  fun partialFor(episodeId: String): File = File(dir, "$episodeId.partial")

  fun has(episodeId: String): Boolean = fileFor(episodeId).let { it.exists() && it.length() > 0 }

  fun cachedIds(): Set<String> = cached().map { it.episodeId }.toSet()

  fun cached(): List<CachedEpisode> =
          dir.listFiles { file -> file.extension == "audio" && file.length() > 0 }
                  ?.map { CachedEpisode(it.nameWithoutExtension, it.length(), it.lastModified()) }
                  ?: emptyList()

  fun usedBytes(): Long = cached().sumOf { it.sizeBytes }

  fun delete(episodeId: String) {
    fileFor(episodeId).delete()
    partialFor(episodeId).delete()
  }

  /** Clears half-written files left by a download that was killed mid-flight. */
  fun clearPartials() {
    dir.listFiles { file -> file.extension == "partial" }?.forEach { it.delete() }
  }
}
