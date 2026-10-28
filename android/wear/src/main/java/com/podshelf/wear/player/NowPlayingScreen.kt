package com.podshelf.wear.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.CompactButton
import androidx.wear.compose.material.CompactChip
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.podshelf.wearsync.formatPlaybackSpeed
import com.podshelf.wearsync.nextPlaybackSpeed
import kotlinx.coroutines.delay

/**
 * The now-playing screen.
 *
 * It exists because without it, tapping an episode started audio and left the user on a list
 * with no way back to it - the only transport controls were the system media notification, which
 * you reach by swiping the app away. That is a strange thing to have to discover.
 *
 * Deliberately one screen of large targets. A watch is operated with one finger, usually while
 * moving, and anything that needs aiming is the wrong control.
 */
@Composable
fun NowPlayingScreen(controller: MediaController?, onBack: () -> Unit) {
  var isPlaying by remember { mutableStateOf(controller?.isPlaying ?: false) }
  var title by remember { mutableStateOf(controller?.mediaMetadata?.title?.toString() ?: "") }
  var artist by remember { mutableStateOf(controller?.mediaMetadata?.artist?.toString() ?: "") }
  var speed by remember { mutableFloatStateOf(controller?.playbackParameters?.speed ?: 1f) }
  var positionMs by remember { mutableLongStateOf(0L) }
  var durationMs by remember { mutableLongStateOf(0L) }

  // The player is a service in another process; its state changes without this screen asking.
  DisposableEffect(controller) {
    val listener =
            object : Player.Listener {
              override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
              }

              override fun onMediaMetadataChanged(metadata: androidx.media3.common.MediaMetadata) {
                title = metadata.title?.toString() ?: ""
                artist = metadata.artist?.toString() ?: ""
              }
            }
    controller?.addListener(listener)
    onDispose { controller?.removeListener(listener) }
  }

  // Position has no callback - there is no "time passed" event - so it is polled while the
  // screen is up. Only while it is up: a watch screen is dark most of a run.
  LaunchedEffect(controller) {
    while (true) {
      controller?.let {
        positionMs = it.currentPosition
        durationMs = if (it.duration > 0) it.duration else 0L
        speed = it.playbackParameters.speed
        isPlaying = it.isPlaying
        if (title.isEmpty()) title = it.mediaMetadata.title?.toString() ?: ""
        if (artist.isEmpty()) artist = it.mediaMetadata.artist?.toString() ?: ""
      }
      delay(500)
    }
  }

  NowPlayingContent(
          title = title,
          artist = artist,
          isPlaying = isPlaying,
          speed = speed,
          progress = if (durationMs > 0) (positionMs.toFloat() / durationMs).coerceIn(0f, 1f) else 0f,
          onSeekBack = { controller?.seekBack() },
          onSeekForward = { controller?.seekForward() },
          onPlayPause = {
            val player = controller ?: return@NowPlayingContent
            if (player.isPlaying) player.pause() else player.play()
          },
          onCycleSpeed = {
            val player = controller ?: return@NowPlayingContent
            val next = nextPlaybackSpeed(player.playbackParameters.speed)
            player.setPlaybackSpeed(next)
            speed = next
          },
          onBack = onBack
  )
}

/**
 * The screen itself, with no player attached.
 *
 * Stateless so the same composable renders in the app and in the screenshot test. A preview that
 * rebuilt this layout would be a second implementation of it, and the screenshot would stop
 * being evidence about the real screen the moment the two drifted.
 */
@Composable
fun NowPlayingContent(
        title: String,
        artist: String,
        isPlaying: Boolean,
        speed: Float,
        progress: Float,
        onSeekBack: () -> Unit = {},
        onSeekForward: () -> Unit = {},
        onPlayPause: () -> Unit = {},
        onCycleSpeed: () -> Unit = {},
        onBack: () -> Unit = {}
) {
  Column(
          modifier = Modifier.fillMaxSize().padding(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 10.dp),
          verticalArrangement = Arrangement.Center,
          horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Text(
            text = title.ifEmpty { "Nothing playing" },
            style = MaterialTheme.typography.button,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
    )
    if (artist.isNotEmpty()) {
      Text(
              text = artist,
              style = MaterialTheme.typography.caption3,
              textAlign = TextAlign.Center,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis
      )
    }

    // Drawn by hand rather than with a progress component: Wear's Material 2 does not ship a
    // linear one, and the circular variant is for indeterminate waits, not for how far through
    // an episode you are.
    Box(
            modifier =
                    Modifier.fillMaxWidth()
                            .padding(vertical = 8.dp)
                            .height(4.dp)
                            .background(MaterialTheme.colors.onSurfaceVariant.copy(alpha = 0.3f))
    ) {
      Box(
              modifier =
                      Modifier.fillMaxHeight()
                              .fillMaxWidth(progress.coerceIn(0f, 1f))
                              .background(MaterialTheme.colors.primary)
      )
    }

    Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
    ) {
      CompactButton(onClick = onSeekBack) {
        Icon(
                painter = androidx.compose.ui.res.painterResource(android.R.drawable.ic_media_rew),
                contentDescription = "Back 10 seconds",
                modifier = Modifier.size(16.dp)
        )
      }

      Button(
              onClick = onPlayPause,
              modifier = Modifier.size(48.dp),
              colors = ButtonDefaults.primaryButtonColors()
      ) {
        Icon(
                painter =
                        androidx.compose.ui.res.painterResource(
                                if (isPlaying) android.R.drawable.ic_media_pause
                                else android.R.drawable.ic_media_play
                        ),
                contentDescription = if (isPlaying) "Pause" else "Play",
                modifier = Modifier.size(20.dp)
        )
      }

      CompactButton(onClick = onSeekForward) {
        Icon(
                painter = androidx.compose.ui.res.painterResource(android.R.drawable.ic_media_ff),
                contentDescription = "Forward 30 seconds",
                modifier = Modifier.size(16.dp)
        )
      }
    }

    // Inset hard from the sides. This row sits near the bottom of a round display, where the
    // usable width is a fraction of the diameter - at full width the two controls were half
    // off the glass and "Queue" wrapped to "Queu/e". Nothing but rendering it at 384x384 shows
    // that, which is what the screenshot test is for.
    // Centred and sized to their own text, not stretched across a fixed width. Forcing them
    // apart on a round screen either pushed them off the glass or squeezed "Queue" down to
    // "Queu" - both of which this test showed and neither of which any other check could.
    Row(
            modifier = Modifier.padding(top = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
    ) {
      // One control cycling a short list, rather than a slider nobody can aim at on a run.
      // Chips rather than CompactButtons because these carry words: a CompactButton is a circle
      // sized for a glyph, and text in one is text that does not fit.
      CompactChip(
              onClick = onCycleSpeed,
              label = { Text(text = formatPlaybackSpeed(speed), maxLines = 1) }
      )

      CompactChip(onClick = onBack, label = { Text(text = "Queue", maxLines = 1) })
    }
  }
}
