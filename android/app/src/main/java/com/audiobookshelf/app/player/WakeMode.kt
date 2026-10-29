package com.audiobookshelf.app.player

import androidx.media3.common.C

/**
 * Which locks the player should hold while it plays.
 *
 * Nothing set this, and nothing declared WAKE_LOCK, for the whole life of the app. With no wake
 * mode ExoPlayer holds no partial wake lock and no Wi-Fi lock, so when the screen goes off the
 * CPU is free to sleep and Wi-Fi drops into power save. Playback survives on whatever is already
 * buffered and then stops - a few seconds after the screen goes off, which is what gets reported.
 *
 * It stayed hidden because a build the user had granted battery-optimisation exemption to does
 * not sleep that way. The bug surfaced on a fresh install under a different applicationId, which
 * carries none of that history: same code, different treatment by the OS.
 *
 * Local files need the CPU only. A stream needs the radio too, and WAKE_MODE_NETWORK is the one
 * that adds the Wi-Fi lock - holding it for local playback would keep the radio up for a file
 * being read off internal storage, which is a battery cost with nothing bought by it.
 */
fun wakeModeFor(isLocal: Boolean): Int =
        if (isLocal) C.WAKE_MODE_LOCAL else C.WAKE_MODE_NETWORK
