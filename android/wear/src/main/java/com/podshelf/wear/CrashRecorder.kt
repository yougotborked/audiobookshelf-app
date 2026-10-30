package com.podshelf.wear

import android.content.Context
import android.util.Log
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.podshelf.wearsync.CrashReport
import com.podshelf.wearsync.WearSync
import java.io.File

/**
 * Writes an uncaught crash to disk, then sends it to the phone on the next launch.
 *
 * Two steps because a crashing process is not one to start an IPC from: the handler only does a
 * synchronous file write and then lets Android kill the app as it would have anyway. The next
 * start - even one that crashes again a moment later - puts the file into the Data Layer, which
 * holds it until the phone is in range. The file is deleted only once the Data Layer has it, so
 * a send that dies with the process is retried rather than lost.
 */
object CrashRecorder {
  private const val TAG = "CrashRecorder"
  private const val FILE = "last-crash.txt"

  fun install(context: Context) {
    val file = File(context.filesDir, FILE)
    val version = versionOf(context)
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      runCatching {
        file.writeText(
                CrashReport.format(
                        version, System.currentTimeMillis(), thread.name, error.stackTraceToString()))
      }
      previous?.uncaughtException(thread, error)
    }
  }

  fun forwardPending(context: Context) {
    val file = File(context.filesDir, FILE)
    if (!file.exists()) return
    val report = runCatching { file.readText() }.getOrNull() ?: return

    val request =
            PutDataMapRequest.create(CrashReport.PATH)
                    .apply {
                      dataMap.putString(WearSync.KEY_PAYLOAD, report)
                      // Two identical crashes would otherwise be the same item, which the
                      // Data Layer treats as no change and never delivers.
                      dataMap.putLong("sentAtMs", System.currentTimeMillis())
                    }
                    .asPutDataRequest()
                    .setUrgent()
    Wearable.getDataClient(context)
            .putDataItem(request)
            .addOnSuccessListener { file.delete() }
            .addOnFailureListener { Log.w(TAG, "Could not hand the crash report over", it) }
  }

  private fun versionOf(context: Context): String =
          runCatching {
                    val info = context.packageManager.getPackageInfo(context.packageName, 0)
                    "${info.versionName} (${info.longVersionCode})"
                  }
                  .getOrDefault("unknown version")
}
