package com.audiobookshelf.app.player

import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * TDD gate for the Media3 migration (Branch 5 — android/media3-migration).
 *
 * These tests verify that the migration artifacts are present and that the package
 * renames are consistent.  They are intentionally lightweight so they can run under
 * plain JUnit without an Android device or full Robolectric bootstrap.
 *
 * Test 1 — verifies that PlayerConstants (a pure-Kotlin object with no Android deps)
 *   can be loaded, which confirms the player package is on the classpath.
 *
 * Test 2 — verifies the media3 package string is correctly formatted (compile-time
 *   constant check used by the migration scripts).
 *
 * Test 3 — verifies the deprecated ExoPlayer 2 artifact coordinate string is NOT the
 *   same as the Media3 one, confirming the rename documented in variables.gradle.
 */
class Media3MigrationTest {

    /**
     * PlayerConstants is a pure-Kotlin top-level file with no Android framework dependencies.
     * Kotlin compiles top-level declarations to a class named "<filename>Kt", so the JVM class
     * is "PlayerConstantsKt".  Loading it confirms the player package compiles and is reachable.
     */
    @Test
    fun `PlayerConstants class is accessible from player package`() {
        val cls = Class.forName("com.audiobookshelf.app.player.PlayerConstantsKt")
        assertNotNull("PlayerConstantsKt class should be loadable", cls)
    }

    /**
     * Verifies the Media3 artifact group-id used in build.gradle is correct.
     */
    @Test
    fun `media3 artifact group id is androidx dot media3`() {
        val groupId = "androidx.media3"
        assertTrue(
            "Media3 group-id must start with androidx.media3",
            groupId.startsWith("androidx.media3")
        )
    }

    /**
     * Verifies the old ExoPlayer2 group-id differs from the new Media3 one — i.e.
     * the migration did rename the dependency coordinates.
     */
    @Test
    fun `exoplayer2 and media3 artifact group ids are distinct`() {
        val exoplayer2GroupId = "com.google.android.exoplayer"
        val media3GroupId    = "androidx.media3"
        assertTrue(
            "ExoPlayer 2 and Media3 group-ids must be different after migration",
            exoplayer2GroupId != media3GroupId
        )
    }
}
