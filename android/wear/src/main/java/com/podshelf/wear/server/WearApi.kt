package com.podshelf.wear.server

import android.os.Build
import com.podshelf.wearsync.WearQueueEntry
import com.podshelf.wearsync.WearServerSession
import com.podshelf.wearsync.trackStreamUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * The watch's own connection to Audiobookshelf.
 *
 * Deliberately not routed through the phone. The whole point is a run with the phone left at
 * home, and a watch that could only fetch while paired would be a worse version of what the
 * phone already does.
 */
class WearApi(private val client: OkHttpClient = defaultClient()) {

  /**
   * Asks the server for a playback session and returns the URL its audio can be fetched from.
   *
   * This is the same two-step the phone does, and it has to be: Audiobookshelf hands out track
   * URLs scoped to a session rather than a stable path per episode, so there is nothing to
   * guess or cache. The URL is used immediately - it stops working once the session closes.
   */
  fun resolveTrackUrl(session: WearServerSession, entry: WearQueueEntry): String? {
    val body =
            JSONObject()
                    .put("mediaPlayer", "exo-player")
                    // Direct play: a watch has no business asking a server to transcode, and a
                    // transcode would hand back a stream rather than a file to keep.
                    .put("forceDirectPlay", true)
                    .put("forceTranscode", false)
                    .put(
                            "deviceInfo",
                            JSONObject()
                                    .put("clientName", "Podshelf Wear")
                                    .put("deviceType", "watch")
                                    .put("manufacturer", Build.MANUFACTURER)
                                    .put("model", Build.MODEL)
                                    .put("sdkVersion", Build.VERSION.SDK_INT)
                    )
                    .toString()
                    .toRequestBody(JSON)

    val url =
            "${session.serverAddress.trimEnd('/')}/api/items/${entry.libraryItemId}/play/${entry.episodeId}"

    val request =
            Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer ${session.token}")
                    .post(body)
                    .build()

    client.newCall(request).execute().use { response ->
      if (!response.isSuccessful) return null
      val payload = response.body.string()
      val tracks = JSONObject(payload).optJSONArray("audioTracks") ?: return null
      // Podcast episodes are a single file. A multi-track item would need concatenating, which
      // is a book problem and not one this app has.
      val contentUrl = tracks.optJSONObject(0)?.optString("contentUrl").orEmpty()
      if (contentUrl.isEmpty()) return null
      return trackStreamUrl(session.serverAddress, contentUrl, session.token)
    }
  }

  fun openStream(url: String): okhttp3.Response =
          client.newCall(Request.Builder().url(url).build()).execute()

  companion object {
    private val JSON = "application/json; charset=utf-8".toMediaType()

    private fun defaultClient(): OkHttpClient =
            OkHttpClient.Builder()
                    .connectTimeout(15, TimeUnit.SECONDS)
                    // No call timeout: an episode is tens of megabytes over a watch's radio and
                    // a whole-call deadline would kill a download that is making fine progress.
                    .readTimeout(60, TimeUnit.SECONDS)
                    .build()
  }
}
