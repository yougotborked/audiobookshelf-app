package com.podshelf.wear

import android.app.Application
import android.content.Context

class PodshelfWearApp : Application() {
  // attachBaseContext, not onCreate: content providers - androidx.startup's among them - are
  // created between the two, and a crash in one of those is exactly the kind this is for.
  override fun attachBaseContext(base: Context) {
    super.attachBaseContext(base)
    CrashRecorder.install(base)
  }

  override fun onCreate() {
    super.onCreate()
    CrashRecorder.forwardPending(this)
  }
}
