package com.podshelf.wearsync

/**
 * A watch crash, written down by the watch and read on the phone.
 *
 * The watch app has crashed on launch in its Play build and nowhere else. Nobody attaches adb to
 * a watch on their wrist, and Play's own crash reports need a diagnostics opt-in and arrive days
 * late. So the watch records its own crash and hands it to the phone over the Data Layer, which
 * puts it in the phone's log screen - somewhere it can be read and copied.
 */
object CrashReport {
  /** Data Layer item path the watch writes a crash to and the phone listens on. */
  const val PATH = "/podshelf/watch-crash"

  /**
   * Comfortably under the Data Layer's 100KB item limit, and far more than a useful trace. A
   * report over it would be refused outright, which is the one outcome worse than a cut one.
   */
  const val MAX_CHARS = 20_000

  fun format(appVersion: String, atMillis: Long, threadName: String, stackTrace: String): String =
          "Watch app crashed - $appVersion, thread \"$threadName\", at ${atMillis}ms epoch\n" +
                  truncate(stackTrace, MAX_CHARS)

  /**
   * Keeps both ends of an over-long trace. The top says where it threw; the bottom holds the
   * last `Caused by:`, which is usually the actual reason. Cutting either end loses half the
   * answer, so the middle - the repetitive frames - is what goes.
   */
  fun truncate(text: String, maxChars: Int): String {
    if (text.length <= maxChars) return text
    val marker = "\n... ${text.length - maxChars} characters cut ...\n"
    val keep = (maxChars - marker.length).coerceAtLeast(0)
    val head = keep / 2
    return text.take(head) + marker + text.takeLast(keep - head)
  }
}
