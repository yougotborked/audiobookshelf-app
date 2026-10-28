package com.podshelf.wear.sync

import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService
import com.podshelf.wear.download.EpisodeDownloadWorker
import com.podshelf.wear.download.DownloadState
import com.podshelf.wear.download.EpisodeStore
import com.podshelf.wearsync.WearSync
import com.podshelf.wearsync.episodesToEvict

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

    // Deleting happens now, not with the downloads.
    //
    // An episode finished on the phone drops out of the next published queue, and that is how
    // the watch learns it is done. Freeing the space needs no network at all, so leaving it to
    // the download pass meant a watch holding episodes someone had already heard until it next
    // found Wi-Fi - which is exactly when it also wants room for new ones.
    val store2 = WearSyncStore.get(this)
    val episodes = EpisodeStore(this)
    val target = DownloadState.get(this).downloadTarget.value
    episodesToEvict(episodes.cached(), store2.queue.value, target).forEach { episodes.delete(it) }

    // Fetching does need a network, so it stays behind WorkManager's constraints: held until
    // the watch is on Wi-Fi, run immediately if it already is.
    EpisodeDownloadWorker.schedule(this)
  }
}
