package com.podshelf.wear.sync

import android.content.Context
import com.podshelf.wearsync.WearQueue
import com.podshelf.wearsync.WearServerSession
import com.podshelf.wearsync.WearSync
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * What the phone last told this watch, kept across restarts.
 *
 * Persisted rather than held in memory because the whole point is a watch that works with the
 * phone absent: the Data Layer replays its items when a connection comes back, but nothing
 * replays them when the watch simply reboots on your wrist mid-run.
 *
 * The raw JSON is what is stored, not the parsed objects. A payload written by a newer phone
 * build then survives this app being older than it - it is decoded with ignoreUnknownKeys, and
 * re-decoded with whatever fields this build understands after an update.
 */
class WearSyncStore(context: Context) {
  private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private val _session = MutableStateFlow(WearSync.decodeSession(prefs.getString(KEY_SESSION, null)))
  val session: StateFlow<WearServerSession?> = _session.asStateFlow()

  private val _queue = MutableStateFlow(WearSync.decodeQueue(prefs.getString(KEY_QUEUE, null)))
  val queue: StateFlow<WearQueue?> = _queue.asStateFlow()

  fun putSessionJson(json: String) {
    val decoded = WearSync.decodeSession(json) ?: return
    prefs.edit().putString(KEY_SESSION, json).apply()
    _session.value = decoded
  }

  fun putQueueJson(json: String) {
    val decoded = WearSync.decodeQueue(json) ?: return
    prefs.edit().putString(KEY_QUEUE, json).apply()
    _queue.value = decoded
  }

  companion object {
    private const val PREFS = "podshelf_wear_sync"
    private const val KEY_SESSION = "session_json"
    private const val KEY_QUEUE = "queue_json"

    @Volatile private var instance: WearSyncStore? = null

    /**
     * One store per process. The listener service and the activity are separate components that
     * both need to see the same state, and two SharedPreferences-backed copies would not share
     * their StateFlows - the screen would sit on stale data until it was recreated.
     */
    fun get(context: Context): WearSyncStore =
            instance
                    ?: synchronized(this) {
                      instance ?: WearSyncStore(context.applicationContext).also { instance = it }
                    }
  }
}
