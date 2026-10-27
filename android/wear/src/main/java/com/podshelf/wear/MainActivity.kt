package com.podshelf.wear

import android.Manifest
import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.app.ActivityCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.google.common.util.concurrent.MoreExecutors
import com.podshelf.wear.download.EpisodeDownloadWorker
import com.podshelf.wear.download.EpisodeStore
import com.podshelf.wear.player.WearPlayerService
import com.podshelf.wear.sync.WearSyncStore
import com.podshelf.wearsync.WearQueue
import com.podshelf.wearsync.WearQueueEntry
import com.podshelf.wearsync.queueMatchesSession

/**
 * The watch app.
 *
 * Shows the catch-up queue the phone resolved and plays it. It does no ordering of its own - see
 * composables/useListeningQueue.ts, the single definition of what plays next - and it reads both
 * the queue and the audio from disk, so a run works with the phone left at home.
 */
class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestLocalNetworkAccessIfNeeded()

    // Opening the app is a good moment to catch up on anything the Data Layer push could not
    // download at the time - the watch was on mobile data, or off Wi-Fi entirely.
    EpisodeDownloadWorker.schedule(this)

    setContent { PodshelfWearApp(WearSyncStore.get(this), EpisodeStore(this)) }
  }

  /**
   * Android 17 blocks a private address unless the app holds this.
   *
   * Asked here rather than before the first request because the failure it prevents is a silent
   * six second timeout against a server that looks perfectly reachable - there is no good moment
   * later to explain that. A watch is also the device most likely to be on the same Wi-Fi as a
   * self-hosted server while the phone is not.
   */
  private fun requestLocalNetworkAccessIfNeeded() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.CINNAMON_BUN) return
    val permission = Manifest.permission.ACCESS_LOCAL_NETWORK
    if (ActivityCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED) {
      return
    }
    ActivityCompat.requestPermissions(this, arrayOf(permission), REQUEST_LOCAL_NETWORK)
  }

  companion object {
    private const val REQUEST_LOCAL_NETWORK = 4201
  }
}

@Composable
fun PodshelfWearApp(store: WearSyncStore, episodes: EpisodeStore) {
  val session by store.session.collectAsStateWithLifecycle()
  val queue by store.queue.collectAsStateWithLifecycle()
  val controller = rememberMediaController()

  MaterialTheme {
    val current = queue
    // A queue from a server the phone has since switched away from is worse than none: its
    // library item ids mean nothing on the new server, so every track would 404.
    if (current == null || current.entries.isEmpty() || !queueMatchesSession(current, session)) {
      WaitingForPhone(hasSession = session != null)
    } else {
      QueueList(current, episodes, controller)
    }
  }
}

/**
 * Connects to the playback service for as long as this screen is on it.
 *
 * A controller rather than the player itself, so playback belongs to the service and survives
 * the screen going dark - which on a watch is most of a run.
 */
@Composable
private fun rememberMediaController(): MediaController? {
  val context = LocalContext.current
  var controller by remember { mutableStateOf<MediaController?>(null) }

  DisposableEffect(context) {
    val token = SessionToken(context, ComponentName(context, WearPlayerService::class.java))
    val future = MediaController.Builder(context, token).buildAsync()
    future.addListener({ controller = future.get() }, MoreExecutors.directExecutor())

    onDispose {
      MediaController.releaseFuture(future)
      controller = null
    }
  }

  return controller
}

@Composable
private fun WaitingForPhone(hasSession: Boolean) {
  Column(
          modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
          verticalArrangement = Arrangement.Center,
          horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Text(text = "Podshelf", style = MaterialTheme.typography.title3, textAlign = TextAlign.Center)
    Text(
            text =
                    if (hasSession) "No episodes to catch up on yet"
                    else "Open Podshelf on your phone to send your queue here",
            style = MaterialTheme.typography.body2,
            textAlign = TextAlign.Center
    )
  }
}

@Composable
private fun QueueList(queue: WearQueue, episodes: EpisodeStore, controller: MediaController?) {
  val listState = rememberScalingLazyListState()
  ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
    item { ListHeader { Text(text = "Up next") } }
    items(queue.entries) { entry ->
      QueueRow(
              entry = entry,
              isDownloaded = episodes.has(entry.episodeId),
              onPlay = { play(entry, episodes, controller) }
      )
    }
  }
}

@Composable
private fun QueueRow(entry: WearQueueEntry, isDownloaded: Boolean, onPlay: () -> Unit) {
  Chip(
          modifier = Modifier.fillMaxWidth(),
          onClick = onPlay,
          // Not downloaded means not playable without the server, and the watch cannot resolve a
          // stream URL from the main thread. Rather than start something that fails mid-tap, the
          // row says what it is waiting for.
          enabled = isDownloaded,
          colors =
                  if (isDownloaded) ChipDefaults.primaryChipColors()
                  else ChipDefaults.secondaryChipColors(),
          label = { Text(text = entry.title, maxLines = 2, overflow = TextOverflow.Ellipsis) },
          secondaryLabel = {
            Text(
                    text = if (isDownloaded) entry.podcastTitle else "Waiting for Wi-Fi",
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
            )
          }
  )
}

/**
 * Starts an episode.
 *
 * Downloaded only, for now: resolving a stream URL means a round trip to the server, which does
 * not belong on the main thread and does not belong in a tap handler that has to answer
 * instantly. Offline is the case that matters here anyway.
 */
private fun play(entry: WearQueueEntry, episodes: EpisodeStore, controller: MediaController?) {
  val player = controller ?: return
  val item = WearPlayerService.mediaItemFor(entry, episodes, streamUrl = null, isOnline = false) ?: return

  player.setMediaItem(item, WearPlayerService.startPositionMs(entry))
  player.prepare()
  player.playWhenReady = true
}
