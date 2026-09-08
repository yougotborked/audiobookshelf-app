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
 * Loads [uri] as a bitmap via Glide, falling back to the app icon if the load fails.
 *
 * No size override: the bitmap is used as the notification and Android Auto background art, both
 * of which are rendered much larger than a list thumbnail.
 */
suspend fun resolveUriAsBitmap(context: Context, uri: Uri): Bitmap? {
  return withContext(Dispatchers.IO) {
    try {
      Glide.with(context)
        .asBitmap()
        .load(uri)
        .placeholder(R.drawable.icon)
        .error(R.drawable.icon)
        .submit()
        .get()
    } catch (e: Exception) {
      Log.e(TAG, "Failed to load cover bitmap for uri: $uri", e)

      Glide.with(context)
        .asBitmap()
        .load(("android.resource://${BuildConfig.APPLICATION_ID}/" + R.drawable.icon).toUri())
        .submit()
        .get()
    }
  }
}
