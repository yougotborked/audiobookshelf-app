package com.podshelf.wearsync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CrashReportTest {
  @Test
  fun `a short trace is kept whole`() {
    val trace = "java.lang.IllegalStateException: boom\n\tat a.b(C.kt:1)"
    assertEquals(trace, CrashReport.truncate(trace, 1_000))
  }

  @Test
  fun `a long trace keeps where it threw and the final cause`() {
    val trace =
            "java.lang.RuntimeException: top\n" +
                    "\tat frame.Repeated(X.kt:1)\n".repeat(5_000) +
                    "Caused by: java.lang.ClassNotFoundException: z5"
    val cut = CrashReport.truncate(trace, 2_000)

    assertTrue(cut.length <= 2_000)
    assertTrue(cut.startsWith("java.lang.RuntimeException: top"))
    assertTrue(cut.endsWith("Caused by: java.lang.ClassNotFoundException: z5"))
    assertTrue(cut.contains("characters cut"))
  }

  @Test
  fun `a formatted report fits a Data Layer item`() {
    val report = CrashReport.format("0.13.0-dev.90-wear", 0, "main", "x".repeat(500_000))
    assertTrue(report.length < 100 * 1024)
    assertTrue(report.startsWith("Watch app crashed - 0.13.0-dev.90-wear"))
  }
}
