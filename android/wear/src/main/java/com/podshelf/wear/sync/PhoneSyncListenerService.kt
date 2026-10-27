package com.podshelf.wear.sync

import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService
import com.podshelf.wear.download.EpisodeDownloadWorker
import com.podshelf.wearsync.WearSync

/**
 * Receives the phone's pushes.
 *
 * A service rather than a listener on the activity: items arrive when the phone has something to
 * say, which is usually while the watch app is closed. Android starts this for the event and the
 * queue is on disk before anyone opens the app.
 */
class PhoneSyncListenerService : WearableListenerService() {
  override fun onDataChanged(dataEvents: DataEventBuffer) {
    val store = WearSyncStore.get(this)

    dataEvents.forEach { event ->
      // TYPE_DELETED carries no payload. Ignored rather than treated as a sign-out: the phone
      // never deletes these items, so a delete here means the Data Layer pruned something, and
      // dropping a cached queue over that would strand a run.
      if (event.type != DataEvent.TYPE_CHANGED) return@forEach

      val path = event.dataItem.uri.path ?: return@forEach
      val payload =
              DataMapItem.fromDataItem(event.dataItem).dataMap.getString(WearSync.KEY_PAYLOAD)
                      ?: return@forEach

      when (path) {
        WearSync.PATH_SESSION -> store.putSessionJson(payload)
        WearSync.PATH_QUEUE -> store.putQueueJson(payload)
      }
    }

    // A new queue is the only thing that changes what should be on disk, so this is where the
    // download pass is asked for. WorkManager holds it until the watch is on Wi-Fi, which is
    // usually that night - and runs it immediately if it already is.
    EpisodeDownloadWorker.schedule(this)
  }
}
