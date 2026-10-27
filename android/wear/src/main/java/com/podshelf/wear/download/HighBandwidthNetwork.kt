package com.podshelf.wear.download

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.util.Log
import com.podshelf.wearsync.suitableForBulkDownload
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Gets the watch onto a network fast enough to pull an episode over.
 *
 * Wear OS routes an app's traffic over whatever it has - Bluetooth proxied through the paired
 * phone, Wi-Fi, or LTE - and swaps between them without telling anyone. That abstraction is the
 * right one for a JSON request: ask for the default network and it works wherever the watch is.
 *
 * It is the wrong one for fifty megabytes. The platform picks the default network by balancing
 * battery against bandwidth, and while the phone is in Bluetooth range that choice is usually
 * the phone proxy, which measures in the hundreds of kbps. It will not turn Wi-Fi on by itself.
 * An app that wants real bandwidth has to ask, which is what this does.
 *
 * Wi-Fi specifically, rather than "anything unmetered": LTE is quick and costs the user money,
 * and fifty megabytes is not ours to spend.
 */
class HighBandwidthNetwork(context: Context) {
  private val connectivity =
          context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

  private var callback: ConnectivityManager.NetworkCallback? = null

  /**
   * True when the network the watch is already on will do.
   *
   * Checked first so a watch sitting on Wi-Fi does not pay for a request and a bind it does not
   * need - and so an LTE watch is not asked to light up a radio it will be refused anyway.
   */
  fun currentNetworkIsFastEnough(): Boolean {
    val network = connectivity.activeNetwork ?: return false
    val capabilities = connectivity.getNetworkCapabilities(network) ?: return false
    return suitableForBulkDownload(
            isMetered = !capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED),
            downstreamBandwidthKbps = capabilities.linkDownstreamBandwidthKbps
    )
  }

  /**
   * Asks for Wi-Fi and binds this process to it, blocking until it arrives or the wait runs out.
   *
   * Blocking is fine and deliberate: the only caller is a WorkManager worker already on a
   * background thread, and the alternative - starting the downloads and hoping the network
   * improves underneath them - is how a transfer ends up half over Bluetooth.
   *
   * Returns false when no Wi-Fi turned up. The radio may simply be off, or there may be no
   * network in range, and `onAvailable` is then never called at all.
   */
  fun acquire(timeoutSeconds: Long = DEFAULT_TIMEOUT_SECONDS): Boolean {
    val latch = CountDownLatch(1)
    var acquired = false

    val networkCallback =
            object : ConnectivityManager.NetworkCallback() {
              override fun onAvailable(network: Network) {
                // Binds the whole process, so OkHttp needs to know nothing about any of this.
                connectivity.bindProcessToNetwork(network)
                acquired = true
                latch.countDown()
              }

              override fun onUnavailable() {
                latch.countDown()
              }
            }

    return try {
      connectivity.requestNetwork(
              NetworkRequest.Builder()
                      .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
                      .build(),
              networkCallback
      )
      callback = networkCallback
      latch.await(timeoutSeconds, TimeUnit.SECONDS)
      acquired
    } catch (e: Exception) {
      Log.d(TAG, "Could not request a Wi-Fi network: ${e.message}")
      release()
      false
    }
  }

  /**
   * Hands the network back.
   *
   * The watch stays on Wi-Fi for as long as the request is registered, so forgetting this drains
   * the battery of a device that has very little of it. Always in a finally.
   */
  fun release() {
    try {
      connectivity.bindProcessToNetwork(null)
      callback?.let { connectivity.unregisterNetworkCallback(it) }
    } catch (e: Exception) {
      Log.d(TAG, "Releasing the network failed: ${e.message}")
    } finally {
      callback = null
    }
  }

  companion object {
    private const val TAG = "HighBandwidthNetwork"

    /**
     * How long to wait for Wi-Fi.
     *
     * Long enough for a radio to come up and associate, short enough that a worker is not
     * holding a wakelock on a watch for nothing. If it expires, WorkManager tries again later -
     * there is no deadline here, only a run that has not happened yet.
     */
    private const val DEFAULT_TIMEOUT_SECONDS = 45L
  }
}
