package com.audiobookshelf.app

import android.os.Build
import com.audiobookshelf.app.device.PermissionHelper
import org.junit.Assert.assertEquals
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
}
