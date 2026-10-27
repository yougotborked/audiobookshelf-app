package com.audiobookshelf.app

import android.os.Build
import com.audiobookshelf.app.device.PermissionHelper
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
class PermissionHelperTest {

    @Test
    @Config(sdk = [33])
    fun `API 33+ returns READ_MEDIA_AUDIO`() {
        assertEquals(
            android.Manifest.permission.READ_MEDIA_AUDIO,
            PermissionHelper.requiredAudioPermission()
        )
    }

    @Test
    @Config(sdk = [32])
    fun `API 32 returns READ_EXTERNAL_STORAGE`() {
        assertEquals(
            android.Manifest.permission.READ_EXTERNAL_STORAGE,
            PermissionHelper.requiredAudioPermission()
        )
    }

    @Test
    @Config(sdk = [26])
    fun `API 26 returns READ_EXTERNAL_STORAGE`() {
        assertEquals(
            android.Manifest.permission.READ_EXTERNAL_STORAGE,
            PermissionHelper.requiredAudioPermission()
        )
    }

    // The SDK level is a parameter rather than read from Build inside the function, so the
    // boundary can be tested at 37 - which Robolectric has no sandbox for yet, and which is
    // the only level where getting this wrong is visible.

    @Test
    fun `API 37 requires the local network permission`() {
        assertEquals(
            android.Manifest.permission.ACCESS_LOCAL_NETWORK,
            PermissionHelper.localNetworkPermission(37)
        )
    }

    @Test
    fun `API 38 still requires the local network permission`() {
        assertEquals(
            android.Manifest.permission.ACCESS_LOCAL_NETWORK,
            PermissionHelper.localNetworkPermission(38)
        )
    }

    // Below 37 the platform grants local access implicitly through INTERNET, and Google's own
    // guidance is not to request this permission there.
    @Test
    fun `API 36 does not request the local network permission`() {
        assertNull(PermissionHelper.localNetworkPermission(36))
    }

    @Test
    fun `the oldest supported API does not request the local network permission`() {
        assertNull(PermissionHelper.localNetworkPermission(26))
    }
}
