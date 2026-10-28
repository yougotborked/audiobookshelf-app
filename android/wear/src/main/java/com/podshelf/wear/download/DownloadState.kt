package com.podshelf.wear.download

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * What the last download pass managed, so the screen can say something true.
 *
 * Kept because the worker and the screen are different components with different lifetimes: by
 * the time someone raises their wrist, the pass that failed may have run hours ago.
 */
class DownloadState(context: Context) {
  private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private val _lastAttemptFailed = MutableStateFlow(prefs.getBoolean(KEY_FAILED, false))
  val lastAttemptFailed: StateFlow<Boolean> = _lastAttemptFailed.asStateFlow()

  /**
   * Whether this watch has ever managed to reach a network good enough to download over.
   *
   * Used as a proxy for "has Wi-Fi set up". Asking the Wi-Fi subsystem directly needs
   * permissions that are a poor trade for a hint, and this answers the question the user
   * actually has - will waiting work? - rather than the one the API answers.
   */
  private val _hasEverDownloaded = MutableStateFlow(prefs.getBoolean(KEY_EVER, false))
  val hasEverDownloaded: StateFlow<Boolean> = _hasEverDownloaded.asStateFlow()

  fun recordAttempt(succeeded: Boolean, acquiredNetwork: Boolean) {
    prefs.edit()
            .putBoolean(KEY_FAILED, !succeeded)
            .apply {
              // Only ever set, never cleared: one good night proves the watch can do this, and
              // a later failure is a different problem than never having been set up.
              if (acquiredNetwork) putBoolean(KEY_EVER, true)
            }
            .apply()

    _lastAttemptFailed.value = !succeeded
    if (acquiredNetwork) _hasEverDownloaded.value = true
  }

  companion object {
    private const val PREFS = "podshelf_wear_downloads"
    private const val KEY_FAILED = "last_attempt_failed"
    private const val KEY_EVER = "has_ever_downloaded"

    @Volatile private var instance: DownloadState? = null

    fun get(context: Context): DownloadState =
            instance
                    ?: synchronized(this) {
                      instance ?: DownloadState(context.applicationContext).also { instance = it }
                    }
  }
}
