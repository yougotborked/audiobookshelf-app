package com.audiobookshelf.app.player

import android.os.Bundle
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.media3.common.Player

// TODO(media3): MediaSessionConnector, TimelineQueueNavigator, and CustomActionProvider were
// removed in Media3.  Media3's MediaSession + MediaSession.Callback replace this whole subsystem.
// These stubs keep PlayerNotificationService compiling while the full MediaSession rewrite is
// deferred to a follow-up task.

/**
 * Stub that mirrors the subset of MediaSessionConnector API used by PlayerNotificationService.
 *
 * TODO(media3): Rewrite PlayerNotificationService.onCreate() to use androidx.media3.session.
 * MediaSession and MediaSession.Callback instead of this connector.
 */
class MediaSessionConnector(val mediaSession: MediaSessionCompat) {

  private var player: Player? = null

  fun setPlayer(player: Player?) {
    this.player = player
  }

  // TODO(media3): setQueueNavigator is a no-op stub; replace with MediaSession queue handling.
  fun setQueueNavigator(navigator: TimelineQueueNavigator?) {
    // no-op during migration
  }

  // TODO(media3): setPlaybackPreparer is a no-op stub; replace with MediaSession.Callback.
  fun setPlaybackPreparer(preparer: PlaybackPreparerCompat?) {
    // no-op during migration
  }

  // TODO(media3): setCustomActionProviders is a no-op stub; replace with MediaSession custom actions.
  fun setCustomActionProviders(vararg providers: CustomActionProvider) {
    // no-op during migration
  }

  // TODO(media3): setEnabledPlaybackActions is a no-op stub.
  fun setEnabledPlaybackActions(actions: Long) {
    // no-op during migration
  }
}

/**
 * Stub for the removed TimelineQueueNavigator.
 *
 * TODO(media3): Rewrite using MediaSession queue / MediaItem metadata.
 */
abstract class TimelineQueueNavigator(val mediaSession: MediaSessionCompat) {
  abstract fun getSupportedQueueNavigatorActions(player: Player): Long
  abstract fun getMediaDescription(player: Player, windowIndex: Int): MediaDescriptionCompat
}

/**
 * Stub interface for the removed MediaSessionConnector.CustomActionProvider.
 *
 * TODO(media3): Replace with MediaSession.Callback.onCustomCommand().
 */
interface CustomActionProvider {
  fun onCustomAction(player: Player, action: String, extras: Bundle?)
  fun getCustomAction(player: Player): PlaybackStateCompat.CustomAction?
}
