package com.podshelf.wear.player

import android.content.Intent
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.common.Player
import com.podshelf.wear.download.EpisodeStore
import com.podshelf.wear.progress.ProgressReportWorker
import com.podshelf.wear.progress.ProgressStore
import com.podshelf.wear.sync.WearSyncStore
import com.podshelf.wearsync.WearProgressRecord
import com.podshelf.wearsync.progressIsFinished
import com.podshelf.wearsync.PlaybackSource
import com.podshelf.wearsync.WearQueueEntry
import com.podshelf.wearsync.autoAdvanceTarget
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
  private lateinit var progress: ProgressStore
  private val handler = Handler(Looper.getMainLooper())

  /**
   * Writes where the listener is, every half minute while playing.
   *
   * Polled rather than driven by player callbacks because there is no callback for "time
   * passed" - the events fire on pause, seek and track change, and a run is forty minutes of
   * none of those. Without the tick, a watch that died mid-episode would report the position it
   * started from.
   */
  private val recordTick =
          object : Runnable {
            override fun run() {
              recordProgress()
              handler.postDelayed(this, RECORD_INTERVAL_MS)
            }
          }

  override fun onCreate() {
    super.onCreate()
    progress = ProgressStore(this)

    val player = ExoPlayer.Builder(this).build()
    player.addListener(
            object : Player.Listener {
              override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) {
                  handler.removeCallbacks(recordTick)
                  handler.postDelayed(recordTick, RECORD_INTERVAL_MS)
                } else {
                  // A pause is the most reliable moment there is: write it down now rather than
                  // waiting for a tick that may never come if the app is killed next.
                  handler.removeCallbacks(recordTick)
                  recordProgress()
                  ProgressReportWorker.schedule(this@WearPlayerService)
                }
              }

              override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) {
                  recordProgress(forceFinished = true)
                  ProgressReportWorker.schedule(this@WearPlayerService)
                  advanceToNext()
                }
              }
            }
    )

    mediaSession = MediaSession.Builder(this, player).build()
  }

  /**
   * Notes where playback has reached.
   *
   * `forceFinished` for the end-of-playback case: the player can report a position a shade short
   * of the duration when it stops, and an episode somebody heard all of should not come back in
   * tomorrow's queue because of a rounding error.
   */
  private fun recordProgress(forceFinished: Boolean = false) {
    val player = mediaSession?.player ?: return
    val episodeId = player.currentMediaItem?.mediaId ?: return
    val entry =
            WearSyncStore.get(this).queue.value?.entries?.firstOrNull { it.episodeId == episodeId }
                    ?: return

    val positionSeconds = player.currentPosition / 1000.0
    val durationSeconds =
            if (player.duration > 0) player.duration / 1000.0 else entry.durationSeconds

    progress.record(
            WearProgressRecord(
                    libraryItemId = entry.libraryItemId,
                    episodeId = episodeId,
                    currentTimeSeconds = positionSeconds,
                    durationSeconds = durationSeconds,
                    isFinished =
                            forceFinished || progressIsFinished(positionSeconds, durationSeconds),
                    updatedAtMs = System.currentTimeMillis()
            )
    )
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
    handler.removeCallbacks(recordTick)
    // Last chance: whatever is on screen is about to stop existing, and an unrecorded run is
    // one the server never hears about.
    recordProgress()
    ProgressReportWorker.schedule(this)

    mediaSession?.run {
      player.release()
      release()
    }
    mediaSession = null
    super.onDestroy()
  }

  /**
   * Plays the next downloaded episode when one finishes.
   *
   * The point of a catch-up queue on a watch is not having to touch it. Skipping past anything
   * not on disk is deliberate - the watch holds only the head of the queue, so stopping at the
   * first gap would end a run early with good episodes sitting on the device.
   */
  private fun advanceToNext() {
    val player = mediaSession?.player ?: return
    val episodes = EpisodeStore(this)
    val queue = WearSyncStore.get(this).queue.value
    val finishedId = player.currentMediaItem?.mediaId

    val next = autoAdvanceTarget(queue, finishedId) { episodes.has(it) } ?: return
    val item = mediaItemFor(next, episodes, streamUrl = null, isOnline = false) ?: return

    // The speed is a preference, not a property of the episode - carrying it across is what
    // someone who listens at 2x expects, and resetting it every episode would be maddening.
    val speed = player.playbackParameters.speed
    player.setMediaItem(item, startPositionMs(next))
    player.setPlaybackSpeed(speed)
    player.prepare()
    player.playWhenReady = true
  }

  companion object {
    /** How often to write the position down while playing. */
    private const val RECORD_INTERVAL_MS = 30_000L

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
