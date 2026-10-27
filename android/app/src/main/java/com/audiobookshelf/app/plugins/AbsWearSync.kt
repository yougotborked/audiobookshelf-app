package com.audiobookshelf.app.plugins

import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.podshelf.wearsync.WearQueue
import com.podshelf.wearsync.WearQueueEntry
import com.podshelf.wearsync.WearServerSession
import com.podshelf.wearsync.WearSync
import com.podshelf.wearsync.queueNeedsPublishing
import com.podshelf.wearsync.sessionNeedsPublishing

/**
 * Publishes the server session and the resolved listening queue to the watch.
 *
 * The webview calls this because that is where the queue is decided - see
 * composables/useListeningQueue.ts, which is the single definition of what plays next. The watch
 * consumes the result and does no ordering of its own.
 *
 * Writes go to the Data Layer rather than a message, because a DataItem persists: a watch that
 * was off, out of range or not yet paired receives the latest state when it next syncs, which is
 * exactly the "went for a run without the phone" case this exists for. Messages would be lost.
 */
@CapacitorPlugin(name = "AbsWearSync")
class AbsWearSync : Plugin() {
  private val tag = "AbsWearSync"

  // What the watch was last told. Comparing against this is what keeps the Data Layer quiet:
  // the phone recomputes the queue far more often than it actually changes, and every write
  // wakes the watch's radio.
  private var lastSession: WearServerSession? = null
  private var lastQueue: WearQueue? = null

  @PluginMethod
  fun publish(call: PluginCall) {
    val session = call.getObject("session")?.toWearSession()
    if (session == null) {
      // Signed out, or no server yet. Nothing to say, and nothing to clear: the watch keeps
      // what it has so a run started before signing out still plays.
      call.resolve(JSObject().apply { put("published", false) })
      return
    }

    var published = false

    if (sessionNeedsPublishing(lastSession, session)) {
      putDataItem(WearSync.PATH_SESSION, WearSync.encodeSession(session))
      lastSession = session
      published = true
    }

    val queue = call.getObject("queue")?.toWearQueue(session.serverConnectionConfigId)
    if (queue != null && queueNeedsPublishing(lastQueue, queue)) {
      putDataItem(WearSync.PATH_QUEUE, WearSync.encodeQueue(queue))
      lastQueue = queue
      published = true
    }

    call.resolve(JSObject().apply { put("published", published) })
  }

  private fun putDataItem(path: String, payload: String) {
    val request =
            PutDataMapRequest.create(path)
                    .apply { dataMap.putString(WearSync.KEY_PAYLOAD, payload) }
                    .asPutDataRequest()
                    // Without this the Data Layer drops a write whose bytes match the last one,
                    // which is usually what you want - but it means a watch that was factory
                    // reset or had the app reinstalled never receives the state it is missing.
                    .setUrgent()

    Wearable.getDataClient(context)
            .putDataItem(request)
            .addOnFailureListener { e ->
              // Not an error the user can act on: no watch paired is the normal case.
              Log.d(tag, "putDataItem $path failed: ${e.message}")
            }
  }

  private fun JSObject.toWearSession(): WearServerSession? {
    val address = getString("serverAddress") ?: return null
    val token = getString("token") ?: return null
    return WearServerSession(
            serverAddress = address,
            token = token,
            userId = getString("userId") ?: "",
            serverConnectionConfigId = getString("serverConnectionConfigId") ?: ""
    )
  }

  private fun JSObject.toWearQueue(serverConnectionConfigId: String): WearQueue {
    val entries = mutableListOf<WearQueueEntry>()
    val array = getJSONArray("entries")
    for (i in 0 until array.length()) {
      val item = array.optJSONObject(i) ?: continue
      val libraryItemId = item.optString("libraryItemId")
      val episodeId = item.optString("episodeId")
      if (libraryItemId.isEmpty() || episodeId.isEmpty()) continue
      entries.add(
              WearQueueEntry(
                      libraryItemId = libraryItemId,
                      episodeId = episodeId,
                      title = item.optString("title"),
                      podcastTitle = item.optString("podcastTitle"),
                      coverPath = item.optString("coverPath").ifEmpty { null },
                      durationSeconds = item.optDouble("durationSeconds", 0.0),
                      currentTimeSeconds = item.optDouble("currentTimeSeconds", 0.0)
              )
      )
    }
    return WearQueue(
            generatedAtMs = System.currentTimeMillis(),
            serverConnectionConfigId = serverConnectionConfigId,
            entries = entries
    )
  }
}
