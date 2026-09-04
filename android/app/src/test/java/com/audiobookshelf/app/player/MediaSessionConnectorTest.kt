@file:androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
package com.audiobookshelf.app.player

import android.net.Uri
import android.os.Bundle
import android.os.Looper
import android.os.ResultReceiver
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.session.MediaControllerCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.SimpleBasePlayer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf

/**
 * Regression tests for [MediaSessionConnector].
 *
 * The Media3 migration left the connector as a set of no-op stubs, so nothing ever called
 * [MediaSessionCompat.setPlaybackState].  Audio played, but the session looked empty to every
 * media controller - Android Auto, Wear OS, the lock screen and Bluetooth head units - and the
 * app was not recognised as a running media player.  These tests assert that player state
 * actually reaches the session.
 */
@RunWith(RobolectricTestRunner::class)
class MediaSessionConnectorTest {

  private lateinit var mediaSession: MediaSessionCompat
  private lateinit var connector: MediaSessionConnector
  private lateinit var player: FakePlayer

  @Before
  fun setUp() {
    mediaSession = MediaSessionCompat(RuntimeEnvironment.getApplication(), "ConnectorTest")
    mediaSession.isActive = true
    connector = MediaSessionConnector(mediaSession)
    player = FakePlayer()
  }

  @After
  fun tearDown() {
    mediaSession.release()
  }

  private fun publishedState(): PlaybackStateCompat {
    idle()
    val controller =
            MediaControllerCompat(RuntimeEnvironment.getApplication(), mediaSession.sessionToken)
    return controller.playbackState
  }

  /** Player state changes are dispatched through the application looper. */
  private fun idle() = shadowOf(Looper.getMainLooper()).idle()

  @Test
  fun `publishes a playback state as soon as it is created`() {
    val state = publishedState()
    assertNotNull("The session must never be left without a playback state", state)
    assertEquals(PlaybackStateCompat.STATE_NONE, state.state)
  }

  @Test
  fun `publishes playing state when the player starts`() {
    connector.setPlayer(player)
    player.update(Player.STATE_READY, playWhenReady = true, itemCount = 1, speed = 1.5f)

    val state = publishedState()
    assertEquals(PlaybackStateCompat.STATE_PLAYING, state.state)
    assertEquals(1.5f, state.playbackSpeed, 0.001f)
  }

  @Test
  fun `publishes paused state with a zero speed so controllers stop extrapolating`() {
    connector.setPlayer(player)
    player.update(Player.STATE_READY, playWhenReady = false, itemCount = 1, speed = 1.5f)

    val state = publishedState()
    assertEquals(PlaybackStateCompat.STATE_PAUSED, state.state)
    assertEquals(0f, state.playbackSpeed, 0.001f)
  }

  @Test
  fun `publishes buffering state`() {
    connector.setPlayer(player)
    player.update(Player.STATE_BUFFERING, playWhenReady = true, itemCount = 1)

    assertEquals(PlaybackStateCompat.STATE_BUFFERING, publishedState().state)
  }

  @Test
  fun `an idle player that still has media loaded stays controllable`() {
    // PlayerNotificationService.play() re-prepares the session, so the controls must stay live
    // rather than dropping to STATE_NONE and disappearing from the system media controls.
    connector.setPlayer(player)
    player.update(Player.STATE_READY, playWhenReady = false, itemCount = 1)
    player.update(Player.STATE_IDLE, playWhenReady = false, itemCount = 1)

    assertEquals(PlaybackStateCompat.STATE_PAUSED, publishedState().state)
  }

  @Test
  fun `publishes whole-book positions from the position provider`() {
    connector.positionProvider =
            object : MediaSessionConnector.PositionProvider {
              override fun getSessionPositionMs(player: Player) = 90_000L

              override fun getSessionBufferedPositionMs(player: Player) = 120_000L
            }
    connector.setPlayer(player)
    player.update(Player.STATE_READY, playWhenReady = true, itemCount = 3)

    val state = publishedState()
    assertEquals(90_000L, state.position)
    assertEquals(120_000L, state.bufferedPosition)
  }

  @Test
  fun `advertises the enabled playback actions and the preparer's prepare actions`() {
    connector.setPlaybackPreparer(NoOpPlaybackPreparer)
    connector.setEnabledPlaybackActions(
            PlaybackStateCompat.ACTION_PLAY_PAUSE or PlaybackStateCompat.ACTION_SEEK_TO
    )
    connector.setPlayer(player)
    player.update(Player.STATE_READY, playWhenReady = true, itemCount = 1)

    val actions = publishedState().actions
    assertTrue(actions and PlaybackStateCompat.ACTION_PLAY_PAUSE != 0L)
    assertTrue(actions and PlaybackStateCompat.ACTION_SEEK_TO != 0L)
    // Without these Android Auto and the Assistant cannot ask the app to play anything
    assertTrue(actions and PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID != 0L)
    assertTrue(actions and PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH != 0L)
  }

  @Test
  fun `publishes the custom actions shown by Android Auto`() {
    connector.setCustomActionProviders(
            customActionProvider(CUSTOM_ACTION_JUMP_BACKWARD),
            customActionProvider(CUSTOM_ACTION_JUMP_FORWARD)
    )
    connector.setPlayer(player)
    player.update(Player.STATE_READY, playWhenReady = true, itemCount = 1)

    val published = publishedState().customActions.map { it.action }
    assertEquals(listOf(CUSTOM_ACTION_JUMP_BACKWARD, CUSTOM_ACTION_JUMP_FORWARD), published)
  }

  @Test
  fun `rebuilds the queue and advertises the navigator actions when media is loaded`() {
    // Robolectric's MediaController does not round-trip the session queue, so the queue itself is
    // observed through the navigator - what matters is that a timeline change rebuilds it.
    val descriptionRequests = mutableListOf<Int>()
    connector.setQueueNavigator(
            object : TimelineQueueNavigator(mediaSession) {
              override fun getSupportedQueueNavigatorActions(player: Player) =
                      PlaybackStateCompat.ACTION_SKIP_TO_NEXT

              override fun getMediaDescription(
                      player: Player,
                      windowIndex: Int
              ): MediaDescriptionCompat {
                descriptionRequests.add(player.mediaItemCount)
                return MediaDescriptionCompat.Builder().setTitle("The Hobbit").build()
              }
            }
    )
    connector.setPlayer(player)
    // A book is loaded as one media item per audio track, but it is a single item to a controller
    player.update(Player.STATE_READY, playWhenReady = true, itemCount = 4)
    idle()

    assertEquals(listOf(4), descriptionRequests)

    val state = publishedState()
    assertEquals(0L, state.activeQueueItemId)
    assertTrue(state.actions and PlaybackStateCompat.ACTION_SKIP_TO_NEXT != 0L)
  }

  @Test
  fun `stops tracking a player once it is detached`() {
    connector.setPlayer(player)
    player.update(Player.STATE_READY, playWhenReady = true, itemCount = 1)
    assertEquals(PlaybackStateCompat.STATE_PLAYING, publishedState().state)

    connector.setPlayer(null)
    assertEquals(PlaybackStateCompat.STATE_NONE, publishedState().state)

    player.update(Player.STATE_READY, playWhenReady = false, itemCount = 1)
    assertEquals(PlaybackStateCompat.STATE_NONE, publishedState().state)
  }

  private fun customActionProvider(action: String) =
          object : CustomActionProvider {
            override fun onCustomAction(player: Player, action: String, extras: Bundle?) = Unit

            override fun getCustomAction(player: Player): PlaybackStateCompat.CustomAction =
                    PlaybackStateCompat.CustomAction.Builder(
                                    action,
                                    action,
                                    android.R.drawable.ic_media_play
                            )
                            .build()
          }

  private object NoOpPlaybackPreparer : PlaybackPreparerCompat {
    override fun onCommand(
            player: Player,
            command: String,
            extras: Bundle?,
            cb: ResultReceiver?
    ) = false

    override fun getSupportedPrepareActions() =
            PlaybackStateCompat.ACTION_PREPARE_FROM_MEDIA_ID or
                    PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID or
                    PlaybackStateCompat.ACTION_PREPARE_FROM_SEARCH or
                    PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH

    override fun onPrepare(playWhenReady: Boolean) = Unit

    override fun onPrepareFromMediaId(mediaId: String, playWhenReady: Boolean, extras: Bundle?) =
            Unit

    override fun onPrepareFromSearch(query: String, playWhenReady: Boolean, extras: Bundle?) = Unit

    override fun onPrepareFromUri(uri: Uri, playWhenReady: Boolean, extras: Bundle?) = Unit
  }

  /** Minimal [Player] whose state the test drives directly. */
  private class FakePlayer : SimpleBasePlayer(Looper.getMainLooper()) {
    private var currentState = buildState(Player.STATE_IDLE, false, 0, 1f)

    fun update(playbackState: Int, playWhenReady: Boolean, itemCount: Int, speed: Float = 1f) {
      currentState = buildState(playbackState, playWhenReady, itemCount, speed)
      invalidateState()
    }

    override fun getState(): State = currentState

    private fun buildState(
            playbackState: Int,
            playWhenReady: Boolean,
            itemCount: Int,
            speed: Float
    ): State {
      val playlist =
              (0 until itemCount).map { index ->
                MediaItemData.Builder("track-$index")
                        .setMediaItem(MediaItem.Builder().setMediaId("track-$index").build())
                        .build()
              }
      return State.Builder()
              .setAvailableCommands(Player.Commands.Builder().addAllCommands().build())
              .setPlaybackState(playbackState)
              .setPlayWhenReady(playWhenReady, Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST)
              .setPlaylist(playlist)
              .setPlaybackParameters(PlaybackParameters(speed))
              .build()
    }
  }
}
