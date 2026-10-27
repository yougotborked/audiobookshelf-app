package com.podshelf.wear

import android.Manifest
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
import androidx.wear.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.app.ActivityCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.podshelf.wear.sync.WearSyncStore
import com.podshelf.wearsync.WearQueue
import com.podshelf.wearsync.WearQueueEntry
import com.podshelf.wearsync.queueMatchesSession

/**
 * The watch app.
 *
 * Shows the catch-up queue the phone resolved. It does no ordering of its own - see
 * composables/useListeningQueue.ts, which is the single definition of what plays next - and it
 * reads the queue from disk, so it works with the phone off, out of range or in another room.
 *
 * Playback is the next piece. Tapping an episode does nothing yet, deliberately: a play button
 * that silently fails is worse than one that is not there.
 */
class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestLocalNetworkAccessIfNeeded()

    val store = WearSyncStore.get(this)
    setContent { PodshelfWearApp(store) }
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
fun PodshelfWearApp(store: WearSyncStore) {
  val session by store.session.collectAsStateWithLifecycle()
  val queue by store.queue.collectAsStateWithLifecycle()

  MaterialTheme {
    val current = queue
    // A queue from a server the phone has since switched away from is worse than none: its
    // library item ids mean nothing on the new server, so every track would 404.
    if (current == null || current.entries.isEmpty() || !queueMatchesSession(current, session)) {
      WaitingForPhone(hasSession = session != null)
    } else {
      QueueList(current)
    }
  }
}

@Composable
private fun WaitingForPhone(hasSession: Boolean) {
  Column(
          modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
          verticalArrangement = Arrangement.Center,
          horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Text(
            text = "Podshelf",
            style = MaterialTheme.typography.title3,
            textAlign = TextAlign.Center
    )
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
private fun QueueList(queue: WearQueue) {
  val listState = rememberScalingLazyListState()
  ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
    item { ListHeader { Text(text = "Up next") } }
    items(queue.entries) { entry -> QueueRow(entry) }
  }
}

@Composable
private fun QueueRow(entry: WearQueueEntry) {
  Chip(
          modifier = Modifier.fillMaxWidth(),
          onClick = {},
          enabled = false,
          colors = ChipDefaults.secondaryChipColors(),
          label = {
            Text(text = entry.title, maxLines = 2, overflow = TextOverflow.Ellipsis)
          },
          secondaryLabel = {
            Text(text = entry.podcastTitle, maxLines = 1, overflow = TextOverflow.Ellipsis)
          }
  )
}
