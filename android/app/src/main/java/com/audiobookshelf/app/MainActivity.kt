package com.audiobookshelf.app

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.net.toUri
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.util.Log
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.core.app.ActivityCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updateLayoutParams
import android.view.WindowInsets
import com.anggrayudi.storage.SimpleStorage
import com.anggrayudi.storage.SimpleStorageHelper
import com.audiobookshelf.app.device.PermissionHelper
import com.audiobookshelf.app.managers.DbManager
import com.audiobookshelf.app.player.PlayerNotificationService
import com.audiobookshelf.app.plugins.AbsAudioPlayer
import com.audiobookshelf.app.plugins.AbsDatabase
import com.audiobookshelf.app.plugins.AbsDownloader
import com.audiobookshelf.app.plugins.AbsFileSystem
import com.audiobookshelf.app.plugins.AbsLogger
import com.getcapacitor.BridgeActivity


class MainActivity : BridgeActivity() {
  private val tag = "MainActivity"

  private var mBounded = false
  lateinit var foregroundService : PlayerNotificationService
  private lateinit var mConnection : ServiceConnection

  lateinit var pluginCallback : () -> Unit

  val storageHelper = SimpleStorageHelper(this)
  val storage = SimpleStorage(this)

  val REQUEST_PERMISSIONS = 1
  var PERMISSIONS_ALL = arrayOf(
    PermissionHelper.requiredAudioPermission()
  )

  public override fun onCreate(savedInstanceState: Bundle?) {
    DbManager.initialize(applicationContext)

    registerPlugin(AbsAudioPlayer::class.java)
    registerPlugin(AbsDownloader::class.java)
    registerPlugin(AbsFileSystem::class.java)
    registerPlugin(AbsDatabase::class.java)
    registerPlugin(AbsLogger::class.java)

    super.onCreate(savedInstanceState)
    Log.d(tag, "onCreate")

    // 4.2 — Edge-to-edge: allow content to draw behind status/nav bars
    WindowCompat.setDecorFitsSystemWindows(window, false)

    // 4.1 — Replace deprecated onBackPressed() with OnBackPressedDispatcher API
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        // Delegate back navigation to the WebView if it can go back,
        // otherwise finish the activity.
        val webView: WebView? = findViewById(R.id.webview)
        if (webView != null && webView.canGoBack()) {
          webView.goBack()
        } else {
          isEnabled = false
          onBackPressedDispatcher.onBackPressed()
        }
      }
    })

    // Update the margins to handle edge-to-edge enforced in SDK 35
    // See: https://developer.android.com/develop/ui/views/layout/edge-to-edge
    val webView: WebView = findViewById(R.id.webview)
    webView.setOnApplyWindowInsetsListener { v, insets ->
      val sysInsets = WindowInsetsCompat.toWindowInsetsCompat(insets, v)
        .getInsets(WindowInsetsCompat.Type.systemBars())
      Log.d(tag, "safe sysInsets: $sysInsets")
      val (left, top, right, bottom) = arrayOf(
        sysInsets.left,
        sysInsets.top,
        sysInsets.right,
        sysInsets.bottom
      )

      // Inject as CSS variables
      // NOTE: Possibly able to use in the future to support edge-to-edge better.
       val js = """
       document.documentElement.style.setProperty('--safe-area-inset-top', '${top}px');
       document.documentElement.style.setProperty('--safe-area-inset-bottom', '${bottom}px');
       document.documentElement.style.setProperty('--safe-area-inset-left', '${left}px');
       document.documentElement.style.setProperty('--safe-area-inset-right', '${right}px');
      """.trimIndent()
      webView.evaluateJavascript(js, null)

      // Set margins
      v.updateLayoutParams<ViewGroup.MarginLayoutParams> {
        leftMargin = left
        bottomMargin = bottom
        rightMargin = right
        topMargin = top
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        WindowInsets.CONSUMED
      } else {
        insets
      }
    }

    val permission = ActivityCompat.checkSelfPermission(this, PermissionHelper.requiredAudioPermission())
    if (permission != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(this,
        PERMISSIONS_ALL,
        REQUEST_PERMISSIONS)
    }

    // Request POST_NOTIFICATIONS permission on Android 13+ for media notification
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      if (ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
        ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_PERMISSIONS)
      }
    }

  }

  override fun onDestroy() {
    super.onDestroy()
  }

  override fun onPostCreate(savedInstanceState: Bundle?) {
    super.onPostCreate(savedInstanceState)
    Log.d(tag, "onPostCreate MainActivity")

    mConnection = object : ServiceConnection {
      override fun onServiceDisconnected(name: ComponentName) {
        Log.w(tag, "Service Disconnected $name")
        mBounded = false
      }

      override fun onServiceConnected(name: ComponentName, service: IBinder) {
        Log.d(tag, "Service Connected $name")

        mBounded = true
        val mLocalBinder = service as PlayerNotificationService.LocalBinder
        foregroundService = mLocalBinder.getService()

        // Let NativeAudio know foreground service is ready and setup event listener
        pluginCallback()
      }
    }

    Intent(this, PlayerNotificationService::class.java).also { intent ->
      Log.d(tag, "Binding PlayerNotificationService")
      bindService(intent, mConnection, Context.BIND_AUTO_CREATE)
    }
  }

  fun isPlayerNotificationServiceInitialized():Boolean {
    return ::foregroundService.isInitialized
  }

  fun stopMyService() {
    if (mBounded) {
      mConnection.let { unbindService(it) };
      mBounded = false;
    }
    val stopIntent = Intent(this, PlayerNotificationService::class.java)
    stopService(stopIntent)
  }

  override fun onSaveInstanceState(outState: Bundle) {
    storageHelper.onSaveInstanceState(outState)
    super.onSaveInstanceState(outState)
    outState.clear()
  }

  override fun onRestoreInstanceState(savedInstanceState: Bundle) {
    super.onRestoreInstanceState(savedInstanceState)
    storageHelper.onRestoreInstanceState(savedInstanceState)
  }

  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    // Mandatory for Activity, but not for Fragment & ComponentActivity
    storageHelper.storage.onActivityResult(requestCode, resultCode, data)
  }

  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    Log.d(tag, "onRequestPermissionResult $requestCode")
    permissions.forEach { Log.d(tag, "PERMISSION $it") }
    grantResults.forEach { Log.d(tag, "GRANTREUSLTS $it") }
    // Mandatory for Activity, but not for Fragment & ComponentActivity
    storageHelper.onRequestPermissionsResult(requestCode, permissions, grantResults)
  }
}
