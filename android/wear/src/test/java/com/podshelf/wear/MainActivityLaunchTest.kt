package com.podshelf.wear

import android.content.ComponentName
import android.os.Looper
import androidx.work.Configuration
import com.podshelf.wear.player.WearPlayerService
import com.podshelf.wear.sync.WearSyncStore
import com.podshelf.wearsync.WearQueue
import com.podshelf.wearsync.WearQueueEntry
import com.podshelf.wearsync.WearServerSession
import com.podshelf.wearsync.WearSync
import androidx.work.WorkManager
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * The watch app opens and stays open.
 *
 * Exists because it did not: installed from Play, the app appeared and closed again at once,
 * and nothing here had ever started the activity - the screenshot test renders composables
 * directly and so cannot see a crash in onCreate, in the first composition, or in anything
 * either of them starts.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w192dp-h192dp-round-watch-xhdpi")
class MainActivityLaunchTest {
  // On a device androidx.startup's InitializationProvider sets WorkManager up before any activity
  // runs. Robolectric does not run that provider, so without this the test fails in
  // EpisodeDownloadWorker.schedule() on a WorkManager that the real app would already have -
  // a failure of the harness, not of the app.
  @Before
  fun initialiseWorkManagerAsTheDeviceWould() {
    val app = RuntimeEnvironment.getApplication()
    // Once per JVM: WorkManager's singleton survives between tests, and Robolectric does not
    // reset it.
    runCatching { WorkManager.initialize(app, Configuration.Builder().build()) }
    // Robolectric answers bindService with a null ComponentName unless told otherwise, and
    // media3 dereferences it. A device always reports the component it bound, so report it.
    shadowOf(app).setComponentNameAndServiceForBindService(ComponentName(app, WearPlayerService::class.java), null)
  }

  @Test
  fun `launches with nothing synced yet`() {
    // A fresh Play install: no session from the phone, no queue, nothing downloaded.
    Robolectric.buildActivity(MainActivity::class.java).setup().use { controller ->
      shadowOf(Looper.getMainLooper()).idle()
      check(!controller.get().isFinishing) { "MainActivity finished itself on launch" }
    }
  }

  @Test
  fun `launches with a session and queue from the phone`() {
    // The state a Play install is actually in seconds after opening: the Play phone app has
    // pushed its session and queue. The empty-install case passing says nothing about this one,
    // and the screens that draw a real queue are where the code changed after the last
    // sideload that worked.
    val app = RuntimeEnvironment.getApplication()
    val store = WearSyncStore(app)
    store.putSessionJson(
            WearSync.encodeSession(
                    WearServerSession("https://abs.example", "token", "user-1", "cfg-1")
            )
    )
    store.putQueueJson(
            WearSync.encodeQueue(
                    WearQueue(
                            generatedAtMs = System.currentTimeMillis(),
                            serverConnectionConfigId = "cfg-1",
                            entries =
                                    listOf(
                                            WearQueueEntry("li-1", "ep-1", "Supernova in the East IV", "Hardcore History", "/api/items/li-1/cover", 14520.0, 0.0),
                                            WearQueueEntry("li-2", "ep-2", "Shadow Brokers", "Darknet Diaries", null, 3840.0, 1200.0),
                                    )
                    )
            )
    )

    Robolectric.buildActivity(MainActivity::class.java).setup().use { controller ->
      shadowOf(Looper.getMainLooper()).idle()
      check(!controller.get().isFinishing) { "MainActivity finished itself with a synced queue" }
    }
  }

  @Test
  fun `the player service starts`() {
    // The activity binds to this the moment it opens, in the same process, so a throw in its
    // onCreate takes the app down just as it appears - and the two tests above never reach it,
    // because the bind they see is answered by the harness rather than by the service.
    val controller = Robolectric.buildService(WearPlayerService::class.java).create()
    shadowOf(Looper.getMainLooper()).idle()
    controller.destroy()
  }
}
