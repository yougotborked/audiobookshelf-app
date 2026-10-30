package com.audiobookshelf.app.services

import com.audiobookshelf.app.managers.DbManager
import com.audiobookshelf.app.plugins.AbsLogger
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import com.podshelf.wearsync.CrashReport
import com.podshelf.wearsync.WearSync

/**
 * Puts a crash the watch app sent into the phone's log screen, where it can be copied.
 *
 * Started by the Data Layer, usually with the phone app closed, so the database is initialised
 * here rather than assumed. The item is deleted once logged: it has been read, and leaving it
 * would only redeliver it.
 */
class WatchCrashListenerService : WearableListenerService() {
  override fun onDataChanged(dataEvents: DataEventBuffer) {
    val reports =
            dataEvents
                    .filter { it.type == DataEvent.TYPE_CHANGED && it.dataItem.uri.path == CrashReport.PATH }
                    .mapNotNull { event ->
                      DataMapItem.fromDataItem(event.dataItem).dataMap.getString(WearSync.KEY_PAYLOAD)
                              ?.let { event.dataItem.uri to it }
                    }
    if (reports.isEmpty()) return

    DbManager.initialize(applicationContext)
    val dataClient = Wearable.getDataClient(this)
    reports.forEach { (uri, report) ->
      AbsLogger.error("WatchCrash", report)
      dataClient.deleteDataItems(uri)
    }
  }
}
