@file:androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
package com.audiobookshelf.app.player

import android.app.PendingIntent
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.core.net.toUri
import android.os.Build
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaControllerCompat
import androidx.media3.common.Player
import androidx.media3.ui.PlayerNotificationManager
import kotlinx.coroutines.*

class AbMediaDescriptionAdapter (private val controller: MediaControllerCompat, private val playerNotificationService: PlayerNotificationService) : PlayerNotificationManager.MediaDescriptionAdapter {
  private val tag = "MediaDescriptionAdapter"

  private var currentIconUri: Uri? = null
  private var currentBitmap: Bitmap? = null

  private val serviceJob = SupervisorJob()
  private val serviceScope = CoroutineScope(Dispatchers.Main + serviceJob)

  override fun createCurrentContentIntent(player: Player): PendingIntent? =
    controller.sessionActivity

  // The session metadata is null until a playback session is prepared, and its fields are
  // individually nullable - an NPE here aborts the notification, which in turn prevents the
  // foreground service (and every system media control) from coming up.
  override fun getCurrentContentText(player: Player) =
    controller.metadata?.description?.subtitle?.toString() ?: ""

  override fun getCurrentContentTitle(player: Player) =
    controller.metadata?.description?.title?.toString() ?: ""

  override fun getCurrentLargeIcon(
    player: Player,
    callback: PlayerNotificationManager.BitmapCallback
  ): Bitmap? {
    val albumArtUri = controller.metadata?.description?.iconUri
    // Reuse the bitmap from the queue navigator (local covers) or from
    // PlaybackSession.resolveCoverBitmapAsync (server covers) rather than loading a second copy
    val albumBitmap = controller.metadata?.description?.iconBitmap
      ?: controller.metadata?.getBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART)

    // For local cover images, bitmap is set in PlayerNotificationService TimelineQueueNavigator.getMediaDescription
    if (albumBitmap != null) {
      return albumBitmap
    }

    return if (currentIconUri != albumArtUri || currentBitmap == null) {
      // Cache the bitmap for the current audiobook so that successive calls to
      // `getCurrentLargeIcon` don't cause the bitmap to be recreated.
      currentIconUri = albumArtUri

      if (currentIconUri.toString().startsWith("content://")) {
        currentBitmap = if (Build.VERSION.SDK_INT < 28) {
          playerNotificationService.contentResolver.openInputStream(currentIconUri!!)?.use { input ->
            BitmapFactory.decodeStream(input)
          }
        } else {
          val source: ImageDecoder.Source = ImageDecoder.createSource(playerNotificationService.contentResolver, currentIconUri!!)
          ImageDecoder.decodeBitmap(source)
        }
        currentBitmap
      } else {
        serviceScope.launch {
          currentBitmap = albumArtUri?.let {
            resolveUriAsBitmap(playerNotificationService, it)
          }
          currentBitmap?.let { callback.onBitmap(it) }
        }
        null
      }
    } else {
      currentBitmap
    }
  }

}
