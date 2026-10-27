package com.podshelf.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text

/**
 * The watch app.
 *
 * Standalone by design: the roadmap's goal is that a run does not need the phone, so this talks
 * to the Audiobookshelf server itself rather than proxying playback through the handset. What it
 * cannot do is ask someone to type a server address and password on a watch, so credentials
 * arrive from the phone over the Wearable Data Layer - which is the next piece, and why this
 * screen currently says what it is waiting for rather than pretending to be a player.
 */
class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContent { PodshelfWearApp() }
  }
}

@Composable
fun PodshelfWearApp() {
  MaterialTheme {
    Column(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
    ) {
      Text(text = "Podshelf", style = MaterialTheme.typography.title3, textAlign = TextAlign.Center)
      Text(
              text = "Waiting for the phone to send your server details",
              style = MaterialTheme.typography.body2,
              textAlign = TextAlign.Center
      )
    }
  }
}
