package com.podshelf.wear

import android.app.Activity
import android.app.Application
import android.content.Context
import android.os.Bundle

// Not PodshelfWearApp: that is the root composable, and a class of the same name in the same
// package compiles - Kotlin picks by arguments - but reads as if one were the other.
class WearApplication : Application() {
  // attachBaseContext, not onCreate: content providers - androidx.startup's among them - are
  // created between the two, and a crash in one of those is exactly the kind this is for.
  override fun attachBaseContext(base: Context) {
    super.attachBaseContext(base)
    CrashRecorder.install(base)
  }

  override fun onCreate() {
    super.onCreate()
    CrashRecorder.forwardPending(this)
    registerActivityLifecycleCallbacks(LifecycleTrail(this))
  }
}

/**
 * Notes each activity lifecycle step in the launch trail.
 *
 * "Opens, then closes" without any uncaught exception means the activity was finished or the
 * process was killed, and the trail tells those apart: a destroy with finishing=true is the app
 * (or the system on its behalf) closing the screen; a trail that stops dead after resume is a
 * kill, which no handler in the app can see.
 */
private class LifecycleTrail(private val context: Context) : Application.ActivityLifecycleCallbacks {
  private fun note(activity: Activity, step: String) =
          CrashRecorder.note(context, "${activity.javaClass.simpleName} $step")

  override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) =
          note(activity, "created (restored=${savedInstanceState != null})")
  override fun onActivityStarted(activity: Activity) = note(activity, "started")
  override fun onActivityResumed(activity: Activity) = note(activity, "resumed")
  override fun onActivityPaused(activity: Activity) = note(activity, "paused")
  override fun onActivityStopped(activity: Activity) = note(activity, "stopped")
  override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
  override fun onActivityDestroyed(activity: Activity) =
          note(activity,
                  "destroyed (finishing=${activity.isFinishing}, " +
                          "config change=${activity.isChangingConfigurations})")
}
