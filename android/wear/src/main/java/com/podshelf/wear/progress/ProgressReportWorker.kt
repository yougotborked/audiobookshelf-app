package com.podshelf.wear.progress

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.podshelf.wear.server.WearApi
import com.podshelf.wear.sync.WearSyncStore
import com.podshelf.wearsync.reportsToSend
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/** Flushes the run's listening to the server once the watch has any connection at all. */
class ProgressReportWorker(context: Context, params: WorkerParameters) :
        CoroutineWorker(context, params) {

  override suspend fun doWork(): Result =
          withContext(Dispatchers.IO) {
            val session = WearSyncStore.get(applicationContext).session.value
                    ?: return@withContext Result.success()

            val store = ProgressStore(applicationContext)
            val pending = reportsToSend(store.records(), WearSyncStore.get(applicationContext).queue.value)
            if (pending.isEmpty()) return@withContext Result.success()

            val api = WearApi()
            val sent = pending.filter { api.reportProgress(session, it) }
            store.forget(sent)

            if (sent.size == pending.size) Result.success() else Result.retry()
          }

  companion object {
    private const val WORK_NAME = "podshelf-progress-report"

    /**
     * Asks for a flush.
     *
     * CONNECTED rather than UNMETERED, unlike the downloads: this is a few hundred bytes, so
     * the Bluetooth proxy through the phone is fine and so is LTE. Waiting for Wi-Fi would mean
     * a run stayed invisible on the phone until the user got home, which is the whole thing
     * this is meant to fix.
     *
     * REPLACE rather than KEEP, also unlike the downloads: a queued flush holds no progress of
     * its own - it reads the store when it runs - so restarting it simply picks up the newest
     * records.
     */
    fun schedule(context: Context) {
      WorkManager.getInstance(context)
              .enqueueUniqueWork(
                      WORK_NAME,
                      ExistingWorkPolicy.REPLACE,
                      OneTimeWorkRequestBuilder<ProgressReportWorker>()
                              .setConstraints(
                                      Constraints.Builder()
                                              .setRequiredNetworkType(NetworkType.CONNECTED)
                                              .build()
                              )
                              .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                              .build()
                      )
    }
  }
}
