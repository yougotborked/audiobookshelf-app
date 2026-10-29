package com.podshelf.wear

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.podshelf.wearsync.DownloadStatus
import com.podshelf.wearsync.WearQueue

/**
 * The queue screen with data handed to it rather than synced to it.
 *
 * Exists so the screenshot test can render the real rows - QueueRow, the same composable the
 * watch draws - without a paired phone, a Data Layer payload or a download on disk. It
 * deliberately builds nothing of its own beyond the list it is given: a preview that recreated
 * the row would stop being evidence about the real screen the moment the two drifted.
 */
@Composable
fun QueuePreview(queue: WearQueue, statuses: Map<String, DownloadStatus>) {
  WearPreviewSurface {
    val listState = rememberScalingLazyListState()
    ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
      item { ListHeader { Text(text = "Up next") } }
      items(queue.entries) { entry ->
        QueueRow(
                entry = entry,
                status = statuses[entry.episodeId] ?: DownloadStatus.WAITING_FOR_WIFI,
                resolving = false,
                onPlay = {}
        )
      }
    }
  }
}

/**
 * The theme plus the background the watch actually draws on.
 *
 * On a device the black comes from the activity's Theme.DeviceDefault, not from Compose, so a
 * composable rendered on its own lands on white - which is not what anyone sees and would be a
 * misleading thing to put in a store listing.
 */
@Composable
fun WearPreviewSurface(content: @Composable () -> Unit) {
  MaterialTheme {
    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colors.background)) { content() }
  }
}
