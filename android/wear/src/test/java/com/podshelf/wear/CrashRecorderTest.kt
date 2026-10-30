package com.podshelf.wear

import java.io.File
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class CrashRecorderTest {
  private val original = Thread.getDefaultUncaughtExceptionHandler()

  @After
  fun restore() = Thread.setDefaultUncaughtExceptionHandler(original)

  @Test
  fun `an uncaught crash is on disk before the process dies`() {
    val app = RuntimeEnvironment.getApplication()
    var passedOn = false
    // Stands in for Android's own handler, which kills the process - and is still called.
    Thread.setDefaultUncaughtExceptionHandler { _, _ -> passedOn = true }

    CrashRecorder.install(app)
    Thread.getDefaultUncaughtExceptionHandler()!!
            .uncaughtException(Thread.currentThread(), IllegalStateException("boom on launch"))

    val report = File(app.filesDir, "last-crash.txt").readText()
    assertTrue(report.startsWith("Watch app crashed"))
    assertTrue(report.contains("IllegalStateException: boom on launch"))
    assertTrue("Android's own handler must still run", passedOn)
  }

  @Test
  fun `every start leaves a line saying which build it was`() {
    val app = RuntimeEnvironment.getApplication()
    CrashRecorder.install(app)
    CrashRecorder.note(app, "MainActivity resumed")

    val trail = File(app.filesDir, "launch-trail.txt").readText()
    assertTrue(trail.contains("process start - "))
    assertTrue(trail.trimEnd().endsWith("MainActivity resumed"))
  }
}
