package com.audiobookshelf.app

import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Tests for platform-hardening changes in MainActivity (task 4.1 / 4.5).
 *
 * We cannot instantiate MainActivity directly under Robolectric because its
 * BridgeActivity superclass was compiled with Java 21 (class file v65) while
 * the Robolectric JVM here only supports up to v61 (Java 17). Instead we verify
 * the OnBackPressedDispatcher / OnBackPressedCallback contract against a plain
 * ComponentActivity, which exercises the same AndroidX API surface.
 *
 * NOTE: lifecycle-aware addCallback(owner, callback) only activates the callback
 * when the owner is at least STARTED. Tests must call controller.start().resume()
 * before asserting hasEnabledCallbacks().
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class MainActivityTest {

    /**
     * Verify that adding an enabled OnBackPressedCallback to a started activity causes
     * hasEnabledCallbacks() to return true.
     */
    @Test
    fun `OnBackPressedDispatcher reports enabled callback after registration`() {
        val controller = Robolectric.buildActivity(ComponentActivity::class.java)
        val activity = controller.create().start().resume().get()

        val dispatcher = activity.onBackPressedDispatcher
        assertFalse(
            "No callbacks should be registered initially",
            dispatcher.hasEnabledCallbacks()
        )

        val callback = object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {}
        }
        dispatcher.addCallback(activity, callback)

        assertTrue(
            "Dispatcher should report enabled callback after addCallback()",
            dispatcher.hasEnabledCallbacks()
        )

        controller.destroy()
    }

    /**
     * Verify that disabling the callback causes hasEnabledCallbacks() to return false.
     */
    @Test
    fun `OnBackPressedDispatcher reports no enabled callbacks when callback is disabled`() {
        val controller = Robolectric.buildActivity(ComponentActivity::class.java)
        val activity = controller.create().start().resume().get()

        val callback = object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {}
        }
        val dispatcher = activity.onBackPressedDispatcher
        dispatcher.addCallback(activity, callback)

        assertTrue("Callback should be enabled initially", dispatcher.hasEnabledCallbacks())

        callback.isEnabled = false
        assertFalse(
            "Dispatcher should report no enabled callbacks after disabling",
            dispatcher.hasEnabledCallbacks()
        )

        controller.destroy()
    }

    /**
     * Verify that an enabled callback intercepts back-press and its handler is invoked,
     * rather than finishing the activity.
     */
    @Test
    fun `enabled OnBackPressedCallback intercepts back press`() {
        val controller = Robolectric.buildActivity(ComponentActivity::class.java)
        val activity = controller.create().start().resume().get()

        var handlerInvoked = false
        val callback = object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                handlerInvoked = true
            }
        }
        activity.onBackPressedDispatcher.addCallback(activity, callback)

        activity.onBackPressedDispatcher.onBackPressed()

        assertTrue("handleOnBackPressed() should have been invoked", handlerInvoked)
        assertFalse("Activity should not be finishing after callback handled back press",
            activity.isFinishing)

        controller.destroy()
    }
}
