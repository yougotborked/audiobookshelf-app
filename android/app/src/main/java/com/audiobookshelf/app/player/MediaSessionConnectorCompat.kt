@file:androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
package com.audiobookshelf.app.player

import android.os.Bundle
import android.os.SystemClock
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import androidx.media3.common.Player

/**
 * Bridges a Media3 [Player] to a [MediaSessionCompat].
 *
 * Media3 removed ExoPlayer 2's `MediaSessionConnector`, whose job was to keep the platform media
 * session in sync with the player.  Everything outside the app - Android Auto, Wear OS, the
 * lock screen and notification shade, Bluetooth/AVRCP head units and the Assistant - discovers
 * playback through [MediaSessionCompat.setPlaybackState] and [MediaSessionCompat.setMetadata].
 * Without a published playback state the session looks empty and the app is not recognised as a
 * running media player even while audio is coming out of the speaker.
 *
 * This class re-implements the half of the old connector this app actually relies on: publishing
 * playback state, the queue and the Android Auto custom actions.  Command handling stays with
 * [MediaSessionCallback], which is installed directly on the session by
 * [PlayerNotificationService] (the old connector's own callback was overwritten by it anyway).
 */
class MediaSessionConnector(val mediaSession: MediaSessionCompat) {

  companion object {
    private const val TAG = "MediaSessionConnector"

    /** Queue id of the single item representing the currently loaded book/episode. */
    private const val CURRENT_ITEM_QUEUE_ID = 0L
  }

  /**
   * Supplies the position reported to media controllers.
   *
   * A book is loaded into the player as one media item per audio track, so the player's own
   * position is relative to the current track while the metadata duration covers the whole book.
   * The service provides whole-book positions here so the scrubber in Android Auto and on the
   * lock screen matches the duration it is drawn against.
   */
  interface PositionProvider {
    fun getSessionPositionMs(player: Player): Long
    fun getSessionBufferedPositionMs(player: Player): Long
  }

  var positionProvider: PositionProvider? = null

  private val componentListener = ComponentListener()

  private var player: Player? = null
  private var queueNavigator: TimelineQueueNavigator? = null
  private var playbackPreparer: PlaybackPreparerCompat? = null
  private var customActionProviders: List<CustomActionProvider> = emptyList()
  private var enabledPlaybackActions: Long =
          PlaybackStateCompat.ACTION_PLAY_PAUSE or
                  PlaybackStateCompat.ACTION_PLAY or
                  PlaybackStateCompat.ACTION_PAUSE or
                  PlaybackStateCompat.ACTION_STOP

  init {
    // Publish a valid (if empty) state right away so controllers that connect before playback
    // starts see a live session instead of a null playback state.
    invalidateMediaSessionPlaybackState()
  }

  fun setPlayer(player: Player?) {
    if (this.player === player) return
    this.player?.removeListener(componentListener)
    this.player = player
    player?.addListener(componentListener)
    invalidateMediaSessionQueue()
    invalidateMediaSessionPlaybackState()
  }

  fun setQueueNavigator(navigator: TimelineQueueNavigator?) {
    queueNavigator = navigator
    invalidateMediaSessionQueue()
    invalidateMediaSessionPlaybackState()
  }

  /**
   * The preparer's commands are handled by [MediaSessionCallback]; only its advertised prepare
   * actions are used here so that Android Auto and the Assistant know the app can be told to
   * play something.
   */
  fun setPlaybackPreparer(preparer: PlaybackPreparerCompat?) {
    playbackPreparer = preparer
    invalidateMediaSessionPlaybackState()
  }

  fun setCustomActionProviders(vararg providers: CustomActionProvider) {
    customActionProviders = providers.toList()
    invalidateMediaSessionPlaybackState()
  }

  fun setEnabledPlaybackActions(actions: Long) {
    if (enabledPlaybackActions == actions) return
    enabledPlaybackActions = actions
    invalidateMediaSessionPlaybackState()
  }

  /** Rebuilds and publishes the [PlaybackStateCompat] for the current player state. */
  fun invalidateMediaSessionPlaybackState() {
    val builder = PlaybackStateCompat.Builder()
    val player = this.player

    if (player == null) {
      mediaSession.setPlaybackState(
              builder
                      .setActions(getPrepareActions())
                      .setState(
                              PlaybackStateCompat.STATE_NONE,
                              0L,
                              0f,
                              SystemClock.elapsedRealtime()
                      )
                      .build()
      )
      return
    }

    customActionProviders.forEach { provider ->
      provider.getCustomAction(player)?.let { builder.addCustomAction(it) }
    }

    val playerError = player.playerError
    val state =
            if (playerError != null) PlaybackStateCompat.STATE_ERROR
            else getMediaSessionPlaybackState(player)
    if (playerError != null) {
      builder.setErrorMessage(
              PlaybackStateCompat.ERROR_CODE_APP_ERROR,
              playerError.message ?: "Playback error"
      )
    }

    val playbackSpeed = player.playbackParameters.speed

    builder
            .setActions(getAvailableActions(player))
            .setActiveQueueItemId(
                    if (player.mediaItemCount > 0) CURRENT_ITEM_QUEUE_ID
                    else MediaSessionCompat.QueueItem.UNKNOWN_ID.toLong()
            )
            .setBufferedPosition(getBufferedPosition(player))
            .setState(
                    state,
                    getPosition(player),
                    if (player.isPlaying) playbackSpeed else 0f,
                    SystemClock.elapsedRealtime()
            )

    mediaSession.setPlaybackState(builder.build())
  }

  /**
   * Publishes a single queue item describing the loaded book or episode.
   *
   * The player timeline holds one window per audio track, but they are all the same book as far
   * as a media controller is concerned, so a per-track queue would just repeat the same entry.
   */
  fun invalidateMediaSessionQueue() {
    val player = this.player
    val navigator = queueNavigator

    if (player == null || navigator == null || player.mediaItemCount == 0) {
      mediaSession.setQueue(emptyList())
      return
    }

    val description: MediaDescriptionCompat =
            try {
              navigator.getMediaDescription(player, player.currentMediaItemIndex)
            } catch (error: Exception) {
              Log.e(TAG, "invalidateMediaSessionQueue: Failed to build media description", error)
              return
            }

    mediaSession.setQueue(
            listOf(MediaSessionCompat.QueueItem(description, CURRENT_ITEM_QUEUE_ID))
    )
  }

  private fun getPosition(player: Player): Long {
    val position =
            positionProvider?.getSessionPositionMs(player) ?: player.currentPosition
    return position.coerceAtLeast(0L)
  }

  private fun getBufferedPosition(player: Player): Long {
    val buffered =
            positionProvider?.getSessionBufferedPositionMs(player) ?: player.bufferedPosition
    return buffered.coerceAtLeast(0L)
  }

  private fun getPrepareActions(): Long = playbackPreparer?.getSupportedPrepareActions() ?: 0L

  private fun getAvailableActions(player: Player): Long {
    var actions = enabledPlaybackActions or getPrepareActions()
    queueNavigator?.let { actions = actions or it.getSupportedQueueNavigatorActions(player) }
    return actions
  }

  private fun getMediaSessionPlaybackState(player: Player): Int =
          when (player.playbackState) {
            Player.STATE_BUFFERING ->
                    if (player.playWhenReady) PlaybackStateCompat.STATE_BUFFERING
                    else PlaybackStateCompat.STATE_PAUSED
            Player.STATE_READY ->
                    if (player.playWhenReady) PlaybackStateCompat.STATE_PLAYING
                    else PlaybackStateCompat.STATE_PAUSED
            Player.STATE_ENDED -> PlaybackStateCompat.STATE_STOPPED
            // An idle player that still has media loaded is reported as paused so the controls
            // stay usable - PlayerNotificationService.play() re-prepares the session on demand.
            else ->
                    if (player.mediaItemCount > 0) PlaybackStateCompat.STATE_PAUSED
                    else PlaybackStateCompat.STATE_NONE
          }

  private inner class ComponentListener : Player.Listener {
    override fun onEvents(player: Player, events: Player.Events) {
      if (events.contains(Player.EVENT_TIMELINE_CHANGED)) {
        invalidateMediaSessionQueue()
      }

      if (events.containsAny(
                      Player.EVENT_TIMELINE_CHANGED,
                      Player.EVENT_MEDIA_ITEM_TRANSITION,
                      Player.EVENT_POSITION_DISCONTINUITY,
                      Player.EVENT_PLAYBACK_STATE_CHANGED,
                      Player.EVENT_PLAY_WHEN_READY_CHANGED,
                      Player.EVENT_IS_PLAYING_CHANGED,
                      Player.EVENT_PLAYBACK_PARAMETERS_CHANGED,
                      Player.EVENT_IS_LOADING_CHANGED,
                      Player.EVENT_PLAYER_ERROR
              )
      ) {
        invalidateMediaSessionPlaybackState()
      }
    }
  }
}

/**
 * Builds the [MediaDescriptionCompat] published as the session queue.
 *
 * Kept as an abstract class with the same shape as ExoPlayer 2's `TimelineQueueNavigator` so the
 * existing implementation in [PlayerNotificationService] is unchanged.
 */
abstract class TimelineQueueNavigator(val mediaSession: MediaSessionCompat) {
  abstract fun getSupportedQueueNavigatorActions(player: Player): Long
  abstract fun getMediaDescription(player: Player, windowIndex: Int): MediaDescriptionCompat
}

/**
 * Supplies a [PlaybackStateCompat.CustomAction] shown by Android Auto and other controllers.
 *
 * `onCustomAction` is never invoked - the session callback ([MediaSessionCallback.onCustomAction])
 * receives the action instead - but it is kept so implementations stay self-describing.
 */
interface CustomActionProvider {
  fun onCustomAction(player: Player, action: String, extras: Bundle?)
  fun getCustomAction(player: Player): PlaybackStateCompat.CustomAction?
}
