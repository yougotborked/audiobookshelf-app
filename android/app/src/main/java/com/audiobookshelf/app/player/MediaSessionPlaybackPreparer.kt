package com.audiobookshelf.app.player

import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ResultReceiver
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import com.audiobookshelf.app.data.LibraryItemWrapper
import com.audiobookshelf.app.data.PodcastEpisode
import androidx.media3.common.Player

// TODO(media3): MediaSessionConnector was removed in Media3 — MediaSession handles connector
// behaviour natively via MediaSession.Callback.  The PlaybackPreparer interface no longer exists.
// This class is replaced by a local stub interface so the file continues to compile while the full
// Media3 MediaSession rewrite is deferred.

/**
 * Stub that mirrors the old MediaSessionConnector.PlaybackPreparer API.
 * TODO(media3): replace with MediaSession.Callback.onPrepare / onPlayFromMediaId overrides.
 */
interface PlaybackPreparerCompat {
  fun onCommand(player: Player, command: String, extras: Bundle?, cb: ResultReceiver?): Boolean
  fun getSupportedPrepareActions(): Long
  fun onPrepare(playWhenReady: Boolean)
  fun onPrepareFromMediaId(mediaId: String, playWhenReady: Boolean, extras: Bundle?)
  fun onPrepareFromSearch(query: String, playWhenReady: Boolean, extras: Bundle?)
  fun onPrepareFromUri(uri: Uri, playWhenReady: Boolean, extras: Bundle?)
}

class MediaSessionPlaybackPreparer(var playerNotificationService: PlayerNotificationService) :
  PlaybackPreparerCompat {

  var tag = "MediaSessionPlaybackPreparer"

  override fun onCommand(player: Player, command: String, extras: Bundle?, cb: ResultReceiver?): Boolean {
    Log.d(tag, "ON COMMAND $command")
    return false
  }

  override fun getSupportedPrepareActions(): Long {
    return PlaybackStateCompat.ACTION_PREPARE_FROM_MEDIA_ID or
      PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID or
      PlaybackStateCompat.ACTION_PREPARE_FROM_SEARCH or
      PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH
  }

  override fun onPrepare(playWhenReady: Boolean) {
    Log.d(tag, "ON PREPARE $playWhenReady")
    playerNotificationService.mediaManager.getFirstItem()?.let { li ->
      playerNotificationService.mediaManager.play(li, null, playerNotificationService.getPlayItemRequestPayload(false)) {
        if (it == null) {
          Log.e(tag, "Failed to play library item")
        } else {
          val playbackRate = playerNotificationService.mediaManager.getSavedPlaybackRate()
          Handler(Looper.getMainLooper()).post {
            playerNotificationService.preparePlayer(it, playWhenReady, playbackRate)
          }
        }
      }
    }
  }

  override fun onPrepareFromMediaId(mediaId: String, playWhenReady: Boolean, extras: Bundle?) {
    Log.d(tag, "ON PREPARE FROM MEDIA ID $mediaId $playWhenReady")

    val libraryItemWrapper: LibraryItemWrapper?
    var podcastEpisode: PodcastEpisode? = null

    val libraryItemWithEpisode = playerNotificationService.mediaManager.getPodcastWithEpisodeByEpisodeId(mediaId)
    if (libraryItemWithEpisode != null) {
      libraryItemWrapper = libraryItemWithEpisode.libraryItemWrapper
      podcastEpisode = libraryItemWithEpisode.episode
    } else {
      libraryItemWrapper = playerNotificationService.mediaManager.getById(mediaId)
    }

    libraryItemWrapper?.let { li ->
      playerNotificationService.mediaManager.play(li, podcastEpisode, playerNotificationService.getPlayItemRequestPayload(false)) {
        if (it == null) {
         Log.e(tag, "Failed to play library item")
        } else {
          val playbackRate = playerNotificationService.mediaManager.getSavedPlaybackRate()
          Handler(Looper.getMainLooper()).post {
            playerNotificationService.preparePlayer(it, playWhenReady, playbackRate)
          }
        }
      }
    }
  }

  override fun onPrepareFromSearch(query: String, playWhenReady: Boolean, extras: Bundle?) {
    Log.d(tag, "ON PREPARE FROM SEARCH $query")
    playerNotificationService.mediaManager.getFromSearch(query)?.let { li ->
      playerNotificationService.mediaManager.play(li, null, playerNotificationService.getPlayItemRequestPayload(false)) {
        if (it == null) {
         Log.e(tag, "Failed to play library item")
        } else {
          val playbackRate = playerNotificationService.mediaManager.getSavedPlaybackRate()
          Handler(Looper.getMainLooper()).post {
            playerNotificationService.preparePlayer(it, playWhenReady, playbackRate)
          }
        }
      }
    }
  }

  override fun onPrepareFromUri(uri: Uri, playWhenReady: Boolean, extras: Bundle?) {
    Log.d(tag, "ON PREPARE FROM URI $uri")
  }
}
