package com.podshelf.wear

import android.content.Context
import android.os.Build
import android.util.Log
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.podshelf.wearsync.CrashReport
import com.podshelf.wearsync.WearSync
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Keeps a trail of what the watch app did, and any crash, and sends both to the phone.
 *
 * Every step is a synchronous append to a small file, because the moments worth recording are
 * the ones just before the process dies. Sending happens at the next start: the trail so far is
 * moved to an outbox and put into the Data Layer, which holds it until the phone is in range. The
 * outbox is only deleted once the Data Layer has it, so a send cut short by another crash is
 * retried rather than lost. Since the move happens on every start, each launch reports itself
 * straight away - which on its own proves the new build is installed and reaching the phone.
 */
object CrashRecorder {
  private const val TAG = "CrashRecorder"
  private const val TRAIL = "launch-trail.txt"
  private const val OUTBOX = "launch-trail-outbox.txt"
  private const val CRASH = "last-crash.txt"

  private val clock = SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.US)

  fun install(context: Context) {
    val crashFile = File(context.filesDir, CRASH)
    val version = versionOf(context)
    note(context, "process start - $version, Android API ${Build.VERSION.SDK_INT}, ${Build.MODEL}")

    val previous = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      runCatching {
        crashFile.writeText(
                CrashReport.format(
                        version, System.currentTimeMillis(), thread.name, error.stackTraceToString()))
      }
      previous?.uncaughtException(thread, error)
    }
  }

  fun note(context: Context, line: String) {
    runCatching {
      File(context.filesDir, TRAIL).appendText("${clock.format(Date())} $line\n")
    }
  }

  fun forwardPending(context: Context) {
    val dir = context.filesDir
    val trail = File(dir, TRAIL)
    val outbox = File(dir, OUTBOX)
    val crash = File(dir, CRASH)

    runCatching {
      if (trail.exists()) {
        outbox.appendText(trail.readText())
        trail.delete()
      }
    }
    if (!outbox.exists() && !crash.exists()) return

    val report =
            CrashReport.combine(
                    runCatching { outbox.readText() }.getOrDefault(""),
                    runCatching { crash.readText() }.getOrNull())

    val request =
            PutDataMapRequest.create(CrashReport.PATH)
                    .apply {
                      dataMap.putString(WearSync.KEY_PAYLOAD, report)
                      // Two identical reports would otherwise be the same item, which the
                      // Data Layer treats as no change and never delivers.
                      dataMap.putLong("sentAtMs", System.currentTimeMillis())
                    }
                    .asPutDataRequest()
                    .setUrgent()
    Wearable.getDataClient(context)
            .putDataItem(request)
            .addOnSuccessListener {
              outbox.delete()
              crash.delete()
            }
            .addOnFailureListener { Log.w(TAG, "Could not hand the report over", it) }
  }

  private fun versionOf(context: Context): String =
          runCatching {
                    val info = context.packageManager.getPackageInfo(context.packageName, 0)
                    "${info.versionName} (${info.longVersionCode})"
                  }
                  .getOrDefault("unknown version")
}
