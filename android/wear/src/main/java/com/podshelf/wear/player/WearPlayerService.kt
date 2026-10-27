package com.podshelf.wear.player

import android.content.Intent
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.podshelf.wear.download.EpisodeStore
import com.podshelf.wear.sync.WearSyncStore
import com.podshelf.wearsync.PlaybackSource
import com.podshelf.wearsync.WearQueueEntry
import com.podshelf.wearsync.playbackSource
import com.podshelf.wearsync.resumePositionMs

/**
 * Playback on the watch.
 *
 * A MediaSessionService rather than a player owned by the activity: audio has to keep going when
 * the screen turns off, which on a watch is roughly immediately, and Bluetooth headphone
 * controls need a media session to talk to.
 */
@OptIn(UnstableApi::class)
class WearPlayerService : MediaSessionService() {
  private var mediaSession: MediaSession? = null

  override fun onCreate() {
    super.onCreate()
    val player = ExoPlayer.Builder(this).build()
    mediaSession = MediaSession.Builder(this, player).build()
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

  override fun onTaskRemoved(rootIntent: Intent?) {
    // A watch app is swiped away constantly and that is not a request to stop the audio - only
    // an idle player should go with it, or a run ends every time someone checks the time.
    val player = mediaSession?.player
    if (player == null || !player.playWhenReady || player.mediaItemCount == 0) {
      stopSelf()
    }
  }

  override fun onDestroy() {
    mediaSession?.run {
      player.release()
      release()
    }
    mediaSession = null
    super.onDestroy()
  }

  companion object {
    /**
     * Builds what the player should play, downloaded file first.
     *
     * Returns null when the episode is neither on disk nor reachable, so the caller can say so
     * instead of handing the player a URL that will fail somewhere out on a run.
     */
    fun mediaItemFor(
            entry: WearQueueEntry,
            store: EpisodeStore,
            streamUrl: String?,
            isOnline: Boolean
    ): MediaItem? {
      val downloaded = store.fileFor(entry.episodeId).takeIf { it.exists() && it.length() > 0 }

      val uri =
              when (val source = playbackSource(downloaded?.absolutePath, isOnline)) {
                is PlaybackSource.Downloaded -> "file://${source.path}"
                PlaybackSource.Stream -> streamUrl ?: return null
                PlaybackSource.Unavailable -> return null
              }

      return MediaItem.Builder()
              .setUri(uri)
              .setMediaId(entry.episodeId)
              .setMediaMetadata(
                      MediaMetadata.Builder()
                              .setTitle(entry.title)
                              .setArtist(entry.podcastTitle)
                              .build()
              )
              .build()
    }

    /** Where to start, read through the same rule the rest of the app uses. */
    fun startPositionMs(entry: WearQueueEntry): Long = resumePositionMs(entry)
  }
}
