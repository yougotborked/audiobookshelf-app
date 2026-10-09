package com.audiobookshelf.app.player

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.util.Log
import androidx.core.net.toUri
import com.audiobookshelf.app.BuildConfig
import com.audiobookshelf.app.R
import com.bumptech.glide.Glide
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val TAG = "CoverImageLoader"

/**
 * Largest cover art we will decode, per side.
 *
 * Generous enough for Android Auto's background art, which is rendered far larger than a list
 * thumbnail, but bounded. Without a bound Glide decodes at the source resolution, and podcast
 * artwork is routinely 3000x3000 - about 36MB as ARGB_8888, for one cover. Several of those at
 * once, alongside a batch of downloads, is an OutOfMemoryError. At this size a cover is ~4MB.
 */
private const val MAX_COVER_PX = 1024

/**
 * Loads [uri] as a bitmap via Glide, falling back to the app icon if the load fails.
 *
 * Returns null rather than throwing: cover art is decoration, and failing to find a picture must
 * never take down playback or the notification that controls it.
 */
suspend fun resolveUriAsBitmap(context: Context, uri: Uri): Bitmap? {
  return withContext(Dispatchers.IO) {
    try {
      Glide.with(context)
        .asBitmap()
        .load(uri)
        .placeholder(R.drawable.icon)
        .error(R.drawable.icon)
        .submit(MAX_COVER_PX, MAX_COVER_PX)
        .get()
    } catch (e: Exception) {
      Log.e(TAG, "Failed to load cover bitmap for uri: $uri", e)

      try {
        Glide.with(context)
          .asBitmap()
          .load(("android.resource://${BuildConfig.APPLICATION_ID}/" + R.drawable.icon).toUri())
          .submit(MAX_COVER_PX, MAX_COVER_PX)
          .get()
      } catch (fallbackError: Exception) {
        // Includes OutOfMemoryError's wrapper from Glide: no art is fine, a crash is not
        Log.e(TAG, "Failed to load fallback cover bitmap", fallbackError)
        null
      }
    }
  }
}
