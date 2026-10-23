package com.audiobookshelf.app.plugins

import com.audiobookshelf.app.device.FoldPosture
import com.audiobookshelf.app.device.FoldState
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Reports the device's fold posture to the webview.
 *
 * WindowManager only hands out postures through a Flow on the activity, so MainActivity does the
 * collecting and pushes results here. This plugin is the webview's end of that: an event for each
 * change, and a getter, because a page that mounts after the last change would otherwise wait for
 * the next fold to find out where it is.
 */
@CapacitorPlugin(name = "AbsFoldPosture")
class AbsFoldPosture : Plugin() {

  override fun load() {
    onPostureChange = { state -> notifyListeners("onFoldPostureChanged", state.toJson()) }
    // A page loading mid-session needs whatever the last collection found, not FLAT.
    lastState?.let { notifyListeners("onFoldPostureChanged", it.toJson()) }
  }

  override fun handleOnDestroy() {
    onPostureChange = null
  }

  @PluginMethod
  fun getPosture(call: PluginCall) {
    call.resolve((lastState ?: FoldState.FLAT).toJson())
  }

  companion object {
    private var onPostureChange: ((FoldState) -> Unit)? = null

    /** Last posture seen, so a late-loading page can ask instead of waiting for a fold. */
    private var lastState: FoldState? = null

    /** Called by MainActivity for every WindowManager layout change. */
    fun update(state: FoldState) {
      if (lastState == state) return
      lastState = state
      onPostureChange?.let { it(state) }
    }

    private fun FoldState.toJson(): JSObject =
            JSObject().apply {
              put(
                      "posture",
                      when (posture) {
                        FoldPosture.FLAT -> "flat"
                        FoldPosture.TABLETOP -> "tabletop"
                        FoldPosture.BOOK -> "book"
                      }
              )
              put("hingeFraction", hingeFraction)
              put("hingeThicknessFraction", hingeThicknessFraction)
            }
  }
}
