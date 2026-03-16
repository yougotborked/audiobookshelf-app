# Android Modernization + UX Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` to implement this plan.

**Goal:** Modernize the audiobookshelf Android app across six sequential branches — fixing M3 UX bugs, upgrading the build system, raising minSdk, fixing storage permissions, hardening Android 14 patterns, and migrating ExoPlayer 2 → Media3 with PaperDB → DataStore.
**Architecture:** Web layer (NuxtJS 2 + Vue 2 + Tailwind) sits inside a Capacitor WebView on Android. Native Kotlin layer handles audio playback via ExoPlayer, foreground service, MediaSession, and Cast. All Android tooling runs inside the `audiobookshelf-dev` distrobox container. Always prefix distrobox commands with `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app && <cmd>"'`.
**Tech Stack:** NuxtJS 2, Vue 2, Tailwind CSS 3, Kotlin 2.1.0, Capacitor 7, ExoPlayer 2.18.7 → Media3 1.5.1, Gradle 8.14.3, AGP 8.13.1, JDK 21, Playwright

> **Command note:** Bare `grep`/`find` commands on host paths (`/home/lab.abork.co/abork/workspace/...`) do NOT need the distrobox wrapper — they run fine on the host. Only build tool commands (`./gradlew`, `nuxt`, `playwright`) require the distrobox prefix.

> **Android Auto note:** This fork supports Android Auto. The `MediaBrowserServiceCompat` intent-filter must be retained in the manifest alongside the Media3 `MediaSessionService` action (both are present in Task 5.5). Full `MediaLibraryService` implementation is out of scope; the existing `BrowseTree` + `onLoadChildren` logic is preserved via the compat filter.

> **DataStore main-thread safety note (Task 5.2):** Before using `runBlocking` in `DbManager`, audit all call sites with `grep -rn "DbManager\." android/app/src/main/java/` to confirm they are on background threads (coroutine dispatchers, service threads). Any call site on the main thread must be moved to a background coroutine before DataStore migration proceeds.

---

## Branch 0 — `ux/p4-polish`

*Web layer only. Ends with a Playwright screenshot gate for user visual approval.*

---

### Task 0.1: Add `rounded-md-2xl` to Tailwind config

**Files:**
- Modify: `tailwind.config.js`

**Step 1: Implement**
In `tailwind.config.js`, inside the `borderRadius` / `rounded` extension, add `'md-2xl': '36px'` after the existing `'md-xl': '28px'` entry. (36px = larger-than-xl, follows Tailwind convention that 2xl > xl.)

Verify `connect.vue` uses `rounded-md-2xl` on the icon container (line ~9). At 36px it will render a noticeably rounded square — visually acceptable for a 80×80 logo container. If it looks too round after the screenshot gate, change it to `rounded-md-xl` (28px) at that point.

**Step 2: Verify**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app && /usr/bin/node node_modules/.bin/nuxt build 2>&1 | tail -5"'`
Expected: build exits 0 with no unknown class warnings.

**Step 3: Commit**
```bash
cd /home/lab.abork.co/abork/workspace/audiobookshelf-app
git checkout -b ux/p4-polish
git add tailwind.config.js
git commit -m "fix(tailwind): add rounded-md-2xl (36px) shape token"
```

---

### Task 0.2: Fix NavBar active pill to wrap icon + label

**Files:**
- Modify: `components/home/BookshelfNavBar.vue`

**Step 1: Implement**
Replace the current absolute-positioned indicator + separate label structure with an inline pill container:

Current structure per tab:
```html
<!-- absolute pill -->
<span v-if="active" class="absolute inset-x-4 top-1 h-8 rounded-md-full bg-md-primary-container" />
<!-- icon -->
<span class="relative z-10 flex items-center justify-center h-6">...</span>
<!-- label below -->
<span v-if="active" class="relative z-10 text-md-label-m text-md-on-surface mt-0.5">{{ item.text }}</span>
```

Replace with:
```html
<!-- Active: pill wraps icon + label -->
<div v-if="routeName === item.routeName"
     class="flex flex-col items-center justify-center rounded-md-full bg-md-primary-container px-5 py-1 min-w-[64px]">
  <span class="flex items-center justify-center h-6">
    <!-- icon markup unchanged -->
  </span>
  <span class="text-md-label-m text-md-on-primary-container leading-tight">{{ item.text }}</span>
</div>
<!-- Inactive: icon only, no pill -->
<span v-else class="flex items-center justify-center h-6">
  <!-- icon markup unchanged, text-md-on-surface-variant -->
</span>
```

Keep the outer `nuxt-link` classes: `flex-1 flex flex-col items-center justify-center py-1 min-h-[56px] relative transition-md-standard`.

**Step 2: Verify (visual)**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app && /usr/bin/node node_modules/.bin/playwright test scripts/screenshot.js --config playwright.config.js 2>&1"'`
Expected: 5 tests pass. Inspect `docs/screenshots/<latest>/02-bookshelf.png` — "Home" label should be inside the green pill.

**Step 3: Commit**
```bash
git add components/home/BookshelfNavBar.vue
git commit -m "fix(navbar): active pill wraps icon + label together (M3 spec)"
```

---

### Task 0.3: Fix mini player background (no gradient, surface-4 base + tint)

**Files:**
- Modify: `components/app/AudioPlayer.vue`
- Modify: `assets/tailwind.css`

**Step 1: Update mini player container**
Find line: `<div id="playerContent" class="playerContainer w-full z-20 absolute bottom-0 left-0 right-0 p-2 pointer-events-auto transition-all" :style="{ backgroundColor: showFullscreen ? '' : coverRgb }" @click="clickContainer">`

Change the `:style` binding to only apply `backgroundColor` when fullscreen (for the fullscreen cover-art tinting effect). For mini, remove the inline style entirely and use a CSS class:

```html
<div id="playerContent"
     class="playerContainer w-full z-20 absolute bottom-0 left-0 right-0 p-2 pointer-events-auto transition-all"
     :class="{ 'bg-md-surface-4': !showFullscreen }"
     :style="showFullscreen ? { backgroundColor: coverRgb } : {}"
     @click="clickContainer">
```

**Step 2: Replace gradient overlay with 15% tint**
Find the mini-state gradient div: `<div v-else class="w-full h-full absolute top-0 left-0 pointer-events-none" style="background: var(--gradient-minimized-audio-player)" />`

Replace with a subtle tint overlay:
```html
<div v-else
     class="w-full h-full absolute top-0 left-0 pointer-events-none rounded-t-md-lg"
     :style="{ backgroundColor: coverRgb, opacity: 0.15 }" />
```

**Step 3: Update gradient CSS variable (keep for fullscreen only)**
In `assets/tailwind.css`, the `--gradient-minimized-audio-player` var is now unused — leave it (harmless) or delete it. No change required to `--gradient-audio-player` (used for fullscreen).

**Step 4: Verify (build)**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app && /usr/bin/node node_modules/.bin/nuxt build 2>&1 | tail -5"'`
Expected: exits 0.

**Step 5: Commit**
```bash
git add components/app/AudioPlayer.vue assets/tailwind.css
git commit -m "fix(player): mini bar uses surface-4 base + 15% cover tint, no gradient"
```

---

### Task 0.4: Fix read-only inputs showing focus border

**Files:**
- Modify: `components/ui/TextInput.vue`

**Step 1: Read the file**
Read `components/ui/TextInput.vue` to find the `focused` data property and where it's set.

**Step 2: Implement**
Find the `@focus="focused = true"` event handler. Change it to:
```js
@focus="if (!readonly) focused = true"
```
Or equivalently, in the focus handler method:
```js
onFocus() {
  if (!this.readonly) this.focused = true
}
```

Also ensure the `readonly` prop is declared in the component's `props`.

**Step 3: Verify**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app && /usr/bin/node node_modules/.bin/playwright test scripts/screenshot.js --config playwright.config.js 2>&1"'`
Expected: 5 tests pass. In `03-settings.png`, the Language/Theme/Haptic inputs should NOT have a green focus border.

**Step 4: Commit**
```bash
git add components/ui/TextInput.vue
git commit -m "fix(text-input): skip focus border on readonly inputs"
```

---

### Task 0.5: Legacy color token cleanup in home page

**Files:**
- Modify: `pages/bookshelf/index.vue`
- Modify: `components/app/Appbar.vue` (if any legacy colors remain)

**Step 1: Audit**
Run: `grep -n "text-fg\b\|text-fg-muted\|bg-primary\b\|bg-secondary\b" /home/lab.abork.co/abork/workspace/audiobookshelf-app/pages/bookshelf/index.vue /home/lab.abork.co/abork/workspace/audiobookshelf-app/components/app/Appbar.vue 2>/dev/null`

**Step 2: Replace**
For each match:
- `text-fg` → `text-md-on-surface`
- `text-fg-muted` → `text-md-on-surface-variant`
- `bg-primary` (as background, not button color) → `bg-md-surface-1`
- `bg-secondary` → `bg-md-surface-2`

Do NOT change `color="primary"` or `color="success"` props on `ui-btn` components — those are handled by the Btn component internally.

**Step 3: Verify + screenshot**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app && /usr/bin/node node_modules/.bin/playwright test scripts/screenshot.js --config playwright.config.js 2>&1"'`
Expected: 5 tests pass. Present `docs/screenshots/<latest>/` to user for visual sign-off.

**Step 4: Commit + push**
```bash
git add pages/bookshelf/index.vue components/app/Appbar.vue
git commit -m "fix(colors): replace legacy fg/primary tokens with M3 equivalents"
git push origin ux/p4-polish
```

**⚠️ SCREENSHOT GATE:** Present all 5 screenshots from `docs/screenshots/<latest>/` to the user. Wait for explicit approval before starting Branch 1.

---

## Branch 1 — `android/build-modernization`

*Android build files only. Zero functional change.*

---

### Task 1.1: Align Kotlin version to 2.1.0 everywhere

**Files:**
- Modify: `android/build.gradle`

**Step 1: Implement**
In `android/build.gradle` `buildscript` block, change:
```groovy
ext.kotlin_version = '2.0.0'
```
to:
```groovy
// kotlin_version defined in variables.gradle as 2.1.0
```
Then add to the top of `build.gradle` after `apply from: "variables.gradle"`:
```groovy
// Use kotlin_version from variables.gradle (2.1.0)
```
The `classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"` line will now resolve from `variables.gradle`'s `2.1.0`.

**Step 2: Verify**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew --version 2>&1 | tail -5"'`
Expected: no resolution errors.

**Step 3: Commit**
```bash
cd /home/lab.abork.co/abork/workspace/audiobookshelf-app
git checkout -b android/build-modernization
git add android/build.gradle
git commit -m "build: align kotlin_version to 2.1.0 from variables.gradle"
```

---

### Task 1.2: Remove kotlinDaemonJvmArgs --add-opens hacks

**Files:**
- Modify: `android/app/build.gradle`

**Step 1: Implement**
Remove the entire `kotlin { kotlinDaemonJvmArgs = [...] }` block (lines with all 11 `--add-opens=jdk.compiler/...` entries). Keep the `kotlin { jvmToolchain(17) }` block if present separately, or keep `kotlinOptions { jvmTarget = '17' }` in the `android {}` block.

**Step 2: Verify**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew compileDebugKotlin --no-daemon 2>&1 | tail -15"'`
Expected: compiles without errors. No `--add-opens` warnings.

**Step 3: Commit**
```bash
git add android/app/build.gradle
git commit -m "build: remove kotlinDaemonJvmArgs --add-opens (not needed with Kotlin 2.1 + JDK 21)"
```

---

### Task 1.3: Migrate kapt → KSP

**Files:**
- Modify: `android/build.gradle` (root — add KSP classpath)
- Modify: `android/app/build.gradle` (plugin swap + dependency swap)
- Modify: `android/variables.gradle` (add ksp_version)

**Step 1: Add KSP version to variables.gradle**
```groovy
ksp_version = '2.1.0-1.0.29'
```

**Step 2: Add KSP to root build.gradle classpath**
In `android/build.gradle` `buildscript.dependencies`:
```groovy
classpath "com.google.devtools.ksp:com.google.devtools.ksp.gradle.plugin:$ksp_version"
```

**Step 3: Update app/build.gradle plugins**
Replace:
```groovy
id 'kotlin-kapt'
```
with:
```groovy
id 'com.google.devtools.ksp'
```

**Step 4: Replace kapt Glide annotation processor**
In `dependencies` block, replace:
```groovy
kapt "com.github.bumptech.glide:compiler:$glide_version"
```
with:
```groovy
ksp "com.github.bumptech.glide:ksp:$glide_version"
```

**Step 5: Verify**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew assembleDebug --no-daemon 2>&1 | tail -20"'`
Expected: BUILD SUCCESSFUL. No kapt tasks in output.

**Step 6: Commit**
```bash
git add android/build.gradle android/app/build.gradle android/variables.gradle
git commit -m "build: migrate kapt → KSP for Glide annotation processing"
```

---

### Task 1.4: Bump OkHttp and Jackson versions

**Files:**
- Modify: `android/app/build.gradle`

**Step 1: Implement**
In `dependencies` block:
- `'com.squareup.okhttp3:okhttp:4.9.2'` → `'com.squareup.okhttp3:okhttp:4.12.0'`
- `'com.fasterxml.jackson.module:jackson-module-kotlin:2.12.2'` → `'com.fasterxml.jackson.module:jackson-module-kotlin:2.18.3'`

**Step 2: Verify**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew assembleDebug --no-daemon 2>&1 | tail -10"'`
Expected: BUILD SUCCESSFUL.

**Step 3: Commit**
```bash
git add android/app/build.gradle
git commit -m "build: bump OkHttp 4.9.2→4.12.0, Jackson 2.12.2→2.18.3"
```

---

### Task 1.5: Full build verification + push

**Step 1: Clean build**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew clean assembleDebug --no-daemon 2>&1 | tail -15"'`
Expected: `BUILD SUCCESSFUL` with APK at `android/app/build/outputs/apk/debug/app-debug.apk`.

**Step 2: Lint**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew lint --no-daemon 2>&1 | grep -E "Error|Warning|BUILD" | tail -15"'`
Expected: BUILD SUCCESSFUL, no new errors introduced.

**Step 3: Push**
```bash
git push origin android/build-modernization
```

---

## Branch 2 — `android/minsdk-26`

---

### Task 2.1: Raise minSdk and remove API guards

**Files:**
- Modify: `android/variables.gradle`
- Modify: any `.kt` files with `Build.VERSION.SDK_INT >= 26` or `@RequiresApi(Build.VERSION_CODES.O)`

**Step 1: Raise minSdk**
In `android/variables.gradle`: `minSdkVersion = 26`

**Step 2: Audit and remove guards**
Run: `grep -rn "SDK_INT >= 26\|SDK_INT > 25\|VERSION_CODES.O\b\|RequiresApi(26\|RequiresApi(Build.VERSION_CODES.O)" /home/lab.abork.co/abork/workspace/audiobookshelf-app/android/app/src/ 2>/dev/null`

For each match: remove the `if (Build.VERSION.SDK_INT >= 26)` branch and keep only the API 26+ code path unconditionally. Remove `@RequiresApi(Build.VERSION_CODES.O)` annotations.

**Step 3: Verify**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew clean assembleDebug --no-daemon 2>&1 | tail -10"'`
Expected: BUILD SUCCESSFUL.

**Step 4: Commit + push**
```bash
cd /home/lab.abork.co/abork/workspace/audiobookshelf-app
git checkout -b android/minsdk-26
git add android/variables.gradle android/app/src/
git commit -m "build: raise minSdk 24→26, remove API 26 guards"
git push origin android/minsdk-26
```

---

## Branch 3 — `android/storage-permissions`

---

### Task 3.1: Write permission gating unit tests (TDD — write first)

**Files:**
- Create: `android/app/src/test/java/com/audiobookshelf/app/PermissionHelperTest.kt`

**Step 1: Create test file**
```kotlin
package com.audiobookshelf.app

import android.os.Build
import com.audiobookshelf.app.device.PermissionHelper  // impl lives in .device subpackage
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
```

**Step 2: Add Robolectric dependency**
In `android/app/build.gradle` `dependencies`:
```groovy
testImplementation "org.robolectric:robolectric:4.13"
testImplementation "junit:junit:$junit_version"
```

**Step 3: Run (expect compile failure — PermissionHelper doesn't exist yet)**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew testDebugUnitTest --no-daemon 2>&1 | tail -15"'`
Expected: compile error — `PermissionHelper` unresolved.

**Step 4: Commit test**
```bash
cd /home/lab.abork.co/abork/workspace/audiobookshelf-app
git checkout -b android/storage-permissions
git add android/app/src/test/ android/app/build.gradle
git commit -m "test(permissions): add PermissionHelper unit tests (failing)"
```

---

### Task 3.2: Implement PermissionHelper + update manifest

**Files:**
- Create: `android/app/src/main/java/com/audiobookshelf/app/device/PermissionHelper.kt`
- Modify: `android/app/src/main/AndroidManifest.xml`

**Step 1: Create PermissionHelper**
```kotlin
package com.audiobookshelf.app.device

import android.Manifest
import android.os.Build

object PermissionHelper {
    fun requiredAudioPermission(): String {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Manifest.permission.READ_MEDIA_AUDIO
        } else {
            Manifest.permission.READ_EXTERNAL_STORAGE
        }
    }
}
```

**Step 2: Update AndroidManifest.xml**
Replace:
```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" ... />
```
With:
```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="29" />
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
```

**Step 3: Find and update runtime permission requests**
Run: `grep -rn "READ_EXTERNAL_STORAGE\|requestPermissions\|checkSelfPermission" /home/lab.abork.co/abork/workspace/audiobookshelf-app/android/app/src/main/ 2>/dev/null | grep -v "\.xml"`
For each Kotlin file that requests `READ_EXTERNAL_STORAGE` at runtime, replace with `PermissionHelper.requiredAudioPermission()`.

**Step 4: Verify tests pass**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew testDebugUnitTest --no-daemon 2>&1 | tail -15"'`
Expected: `3 tests passed`.

**Step 5: Verify build**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew assembleDebug --no-daemon 2>&1 | tail -10"'`
Expected: BUILD SUCCESSFUL.

**Step 6: Commit + push**
```bash
git add android/app/src/main/ android/app/build.gradle
git commit -m "feat(permissions): READ_MEDIA_AUDIO for API 33+, PermissionHelper abstraction"
git push origin android/storage-permissions
```

---

## Branch 4 — `android/platform-hardening`

---

### Task 4.1: Write SleepTimerManager unit tests (TDD — write first)

**Files:**
- Create: `android/app/src/test/java/com/audiobookshelf/app/managers/SleepTimerManagerTest.kt`

**Step 1: Identify SleepTimerManager API**
Read `android/app/src/main/java/com/audiobookshelf/app/managers/SleepTimerManager.kt` to understand its public methods, state fields, and how it interfaces with PlayerNotificationService.

**Step 2: Write characterization tests**
Use this skeleton (adapt field names to match actual `SleepTimerManager` API after reading it):
```kotlin
package com.audiobookshelf.app.managers

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class SleepTimerManagerTest {

    private var firedCount = 0
    private val testCallback = object : SleepTimerCallback {
        override fun onSleepTimerFired() { firedCount++ }
        override fun onSleepTimerExtended(newDurationMs: Long) {}
    }
    private lateinit var manager: SleepTimerManager

    @Before
    fun setup() {
        firedCount = 0
        manager = SleepTimerManager(testCallback)
    }

    @Test
    fun `set timer marks isActive true`() {
        manager.set(60_000L)
        assertTrue(manager.isActive)
    }

    @Test
    fun `cancel clears active state`() {
        manager.set(60_000L)
        manager.cancel()
        assertFalse(manager.isActive)
    }

    @Test
    fun `cancel before set does not throw`() {
        manager.cancel() // idempotent
        assertFalse(manager.isActive)
    }

    @Test
    fun `multiple cancels do not throw`() {
        manager.set(60_000L)
        manager.cancel()
        manager.cancel()
        assertFalse(manager.isActive)
    }
}
```
If `SleepTimerManager` currently has no `SleepTimerCallback` interface, Task 4.3 will add it. The test is written first to drive that extraction.

**Step 3: Run (expect failures)**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew testDebugUnitTest --no-daemon 2>&1 | tail -20"'`
Expected: tests run but may fail if SleepTimerManager needs refactoring to be testable.

**Step 4: Commit**
```bash
cd /home/lab.abork.co/abork/workspace/audiobookshelf-app
git checkout -b android/platform-hardening
git add android/app/src/test/
git commit -m "test(sleep-timer): add SleepTimerManager unit tests (TDD)"
```

---

### Task 4.2: Replace deprecated onBackPressed + edge-to-edge

**Files:**
- Modify: `android/app/src/main/java/com/audiobookshelf/app/MainActivity.kt`

**Step 1: Find and replace onBackPressed**
Run: `grep -n "onBackPressed\|override fun onBackPressed" /home/lab.abork.co/abork/workspace/audiobookshelf-app/android/app/src/main/java/com/audiobookshelf/app/MainActivity.kt`

Replace any `override fun onBackPressed()` with:
```kotlin
onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
    override fun handleOnBackPressed() {
        // existing onBackPressed logic here
    }
})
```
Add to `onCreate()` (or wherever current `onBackPressed` logic lives).

Import: `androidx.activity.OnBackPressedCallback`

**Step 2: Add edge-to-edge**
In `MainActivity.onCreate()`, after `super.onCreate()`:
```kotlin
WindowCompat.setDecorFitsSystemWindows(window, false)
ViewCompat.setOnApplyWindowInsetsListener(binding.root) { v, insets ->
    val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
    v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
    insets
}
```
Imports: `androidx.core.view.WindowCompat`, `androidx.core.view.ViewCompat`, `androidx.core.view.WindowInsetsCompat`

**Step 3: Verify**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew compileDebugKotlin --no-daemon 2>&1 | tail -10"'`
Expected: compiles without deprecation errors.

**Step 4: Commit**
```bash
git add android/app/src/main/java/com/audiobookshelf/app/MainActivity.kt
git commit -m "fix(activity): OnBackPressedCallback + edge-to-edge WindowCompat"
```

---

### Task 4.3: Wake lock audit + SleepTimerManager tests green

**Files:**
- Modify: `android/app/src/main/java/com/audiobookshelf/app/managers/SleepTimerManager.kt`
- Modify: `android/app/src/main/java/com/audiobookshelf/app/player/PlayerNotificationService.kt` (wake lock sections only)

**Step 1: Audit wake locks**
Run: `grep -n "PARTIAL_WAKE_LOCK\|wakeLock\|acquire\|release" /home/lab.abork.co/abork/workspace/audiobookshelf-app/android/app/src/main/java/com/audiobookshelf/app/managers/SleepTimerManager.kt /home/lab.abork.co/abork/workspace/audiobookshelf-app/android/app/src/main/java/com/audiobookshelf/app/player/PlayerNotificationService.kt 2>/dev/null`

**Step 2: Wrap acquisitions in try/finally**
For any `wakeLock.acquire()` that isn't already in a `try/finally` block with `release()` in the `finally`:
```kotlin
wakeLock.acquire(timeout)
try {
    // ... work
} finally {
    if (wakeLock.isHeld) wakeLock.release()
}
```

**Step 3: Make SleepTimerManager unit-testable if needed**
If `SleepTimerManager` directly accesses `PlayerNotificationService` in a way that prevents unit testing, extract the callback to an interface:
```kotlin
interface SleepTimerCallback {
    fun onSleepTimerFired()
    fun onSleepTimerExtended(newDurationMs: Long)
}
```
Update `SleepTimerManagerTest` to use a test double for this interface.

**Step 4: Verify tests pass**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew testDebugUnitTest --no-daemon 2>&1 | tail -20"'`
Expected: all SleepTimerManager tests pass.

**Step 5: Full build**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew clean assembleDebug --no-daemon 2>&1 | tail -10"'`
Expected: BUILD SUCCESSFUL.

**Step 6: Commit**
```bash
git add android/app/src/main/ android/app/src/test/
git commit -m "fix(hardening): wake lock try/finally, SleepTimerCallback interface, tests green"
```

---

### Task 4.4: Battery optimization exemption request

**Files:**
- Modify: `android/app/src/main/java/com/audiobookshelf/app/player/PlayerNotificationService.kt`
- Modify: `android/app/src/main/AndroidManifest.xml`

**Step 1: Audit**
Run: `grep -rn "IGNORE_BATTERY_OPTIMIZATIONS\|isIgnoringBatteryOptimizations" /home/lab.abork.co/abork/workspace/audiobookshelf-app/android/app/src/main/java/ 2>/dev/null`
If already present and covering the app package, skip Step 2.

**Step 2: Implement**
In `PlayerNotificationService.onCreate()`, add a one-time prompt:
```kotlin
val pm = getSystemService(POWER_SERVICE) as PowerManager
if (!pm.isIgnoringBatteryOptimizations(packageName)) {
    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = Uri.parse("package:$packageName")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    startActivity(intent)
}
```
Imports: `android.os.PowerManager`, `android.provider.Settings`, `android.net.Uri`

In `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
```

**Step 3: Full build + push**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew clean assembleDebug --no-daemon 2>&1 | tail -10"'`
Expected: BUILD SUCCESSFUL.

```bash
git add android/app/src/main/
git commit -m "fix(battery): request IGNORE_BATTERY_OPTIMIZATIONS on first service start"
git push origin android/platform-hardening
```

---

## Branch 5 — `android/media3-migration`

*Three sub-steps. All must pass before the branch is pushed.*

---

### Task 5.1: Write DbManager characterization tests (TDD — write first)

**Files:**
- Read: `android/app/src/main/java/com/audiobookshelf/app/managers/DbManager.kt`
- Create: `android/app/src/test/java/com/audiobookshelf/app/managers/DbManagerTest.kt`

**Step 1: Read DbManager**
Read the full `DbManager.kt` to understand its public API (read/write methods, key names, data structures).

**Step 2: Write characterization tests**
Cover all public methods:
- `saveDeviceData(data)` / `getDeviceData()` round-trip
- `saveServerConnectionConfigs(list)` / `getServerConnectionConfigs()` round-trip
- `getCurrentServerConnectionConfig()` returns the saved config
- Missing key returns null or default (not crash)
- Overwriting existing data stores new value

Use `@Before` to initialize a test context and `@After` to clean up.

**Step 3: Run (expect failures — PaperDB needs Android context)**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew testDebugUnitTest --tests "*DbManagerTest*" --no-daemon 2>&1 | tail -15"'`
Expected: tests may fail due to Android context dependency — that's the gap TDD is surfacing. Adjust tests to use Robolectric if needed.

**Step 4: Commit**
```bash
cd /home/lab.abork.co/abork/workspace/audiobookshelf-app
git checkout -b android/media3-migration
git add android/app/src/test/
git commit -m "test(dbmanager): characterization tests before PaperDB migration (TDD)"
```

---

### Task 5.2: Replace PaperDB → DataStore Preferences

**Files:**
- Modify: `android/app/build.gradle`
- Modify: `android/app/src/main/java/com/audiobookshelf/app/managers/DbManager.kt`

**Step 1: Add DataStore dependency**
In `build.gradle` `dependencies`:
```groovy
implementation "androidx.datastore:datastore-preferences:1.1.1"
```
Remove:
```groovy
implementation 'io.github.pilgr:paperdb:2.7.2'
```

**Step 2: Rewrite DbManager internals**
Keep the public API (`fun saveDeviceData()`, `fun getDeviceData()`, etc.) identical. Internally replace `Paper.book().write(key, value)` / `Paper.book().read(key)` with DataStore operations using `runBlocking { dataStore.edit { prefs -> prefs[key] = json } }` / `runBlocking { dataStore.data.first()[key] }`.

Use Jackson (already a dependency) for JSON serialization of complex objects (server configs, device data).

Initialize DataStore as a singleton: `val Context.deviceDataStore: DataStore<Preferences> by preferencesDataStore(name = "device_data")`

**Step 3: One-time migration from PaperDB**
In `DbManager.init()` or first read, check if PaperDB files exist at `$filesDir/io.paperdb/`. If so, read them once and migrate each key to DataStore. **Do NOT delete the old PaperDB files until all values have been successfully written to DataStore and verified with a read-back check.** Only delete them after confirming the DataStore values are non-null. If migration fails, log the error and leave PaperDB files intact as a fallback for the next launch attempt.

**Step 4: Verify tests pass**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew testDebugUnitTest --tests "*DbManagerTest*" --no-daemon 2>&1 | tail -15"'`
Expected: all DbManager tests pass.

**Step 5: Build**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew assembleDebug --no-daemon 2>&1 | tail -10"'`
Expected: BUILD SUCCESSFUL, no PaperDB references in build output.

**Step 6: Commit**
```bash
git add android/app/build.gradle android/app/src/main/java/com/audiobookshelf/app/managers/DbManager.kt
git commit -m "feat(db): replace PaperDB with DataStore Preferences, one-time migration"
```

---

### Task 5.3: Swap ExoPlayer 2 dependencies and fix imports

**Files:**
- Modify: `android/variables.gradle`
- Modify: `android/app/build.gradle`
- Modify: all 11 files using `com.google.android.exoplayer2`

**Step 1: Update variables.gradle**
Remove: `exoplayer_version = '2.18.7'`
Add: `media3_version = '1.5.1'`

**Step 2: Update build.gradle dependencies**
Replace the 5 exoplayer deps with:
```groovy
implementation "androidx.media3:media3-exoplayer:$media3_version"
implementation "androidx.media3:media3-ui:$media3_version"
implementation "androidx.media3:media3-session:$media3_version"
implementation "androidx.media3:media3-cast:$media3_version"
implementation "androidx.media3:media3-exoplayer-hls:$media3_version"
```
Remove `force("androidx.media:media:$androidx_media_version")` from `resolutionStrategy` (no longer needed).

**Step 3: Find all files to update**
Run: `grep -rln "com.google.android.exoplayer2" /home/lab.abork.co/abork/workspace/audiobookshelf-app/android/app/src/main/java/ 2>/dev/null`

**Step 4: Do import rename in each file**
Package-level renames (apply to all 11 files):
- `com.google.android.exoplayer2` → `androidx.media3.exoplayer` (for exoplayer-specific)
- `com.google.android.exoplayer2.ext.mediasession` → `androidx.media3.session`
- `com.google.android.exoplayer2.ext.cast` → `androidx.media3.cast`
- `com.google.android.exoplayer2.source.hls` → `androidx.media3.exoplayer.hls`
- `com.google.android.exoplayer2.extractor` → `androidx.media3.extractor`
- `com.google.android.exoplayer2.upstream` → `androidx.media3.datasource`
- `com.google.android.exoplayer2.ui` → `androidx.media3.ui`

Key class renames: `SimpleExoPlayer` → `ExoPlayer` (Media3 removed SimpleExoPlayer).

**Step 5: Compile check**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew compileDebugKotlin --no-daemon 2>&1 | grep -E "error:|warning:" | head -20"'`
Expected: no errors (warnings acceptable). Fix any remaining import errors.

**Step 6: Commit**
```bash
# Stage the 11 renamed files explicitly (list them from the grep output in Step 3)
# plus the build files
git add android/variables.gradle android/app/build.gradle
git add android/app/src/main/java/com/audiobookshelf/app/player/PlayerNotificationService.kt
git add android/app/src/main/java/com/audiobookshelf/app/player/CastPlayer.kt
git add android/app/src/main/java/com/audiobookshelf/app/player/CastManager.kt
git add android/app/src/main/java/com/audiobookshelf/app/player/CastTimeline.kt
git add android/app/src/main/java/com/audiobookshelf/app/player/CastTimelineTracker.kt
git add android/app/src/main/java/com/audiobookshelf/app/player/CastTrackSelection.kt
git add android/app/src/main/java/com/audiobookshelf/app/player/MediaSessionPlaybackPreparer.kt
git add android/app/src/main/java/com/audiobookshelf/app/player/PlayerListener.kt
git add android/app/src/main/java/com/audiobookshelf/app/player/PlayerNotificationListener.kt
git add android/app/src/main/java/com/audiobookshelf/app/data/PlaybackSession.kt
# Add any additional files found by the grep in Step 3
git commit -m "feat(media3): replace ExoPlayer 2 deps with Media3 1.5.1, rename imports in 11 files"
```

---

### Task 5.4: Write MediaSession instrumented tests (TDD — gate on Task 5.5)
> **Ordering note:** Task 5.3 (import rename) must be done first so tests can reference `androidx.media3` APIs. Task 5.4 writes the test scaffold against those APIs. Task 5.5 (structural `MediaSessionService` migration) must NOT begin until this test file is committed. The test is the safety net for 5.5.

**Files:**
- Create: `android/app/src/androidTest/java/com/audiobookshelf/app/player/PlayerNotificationServiceTest.kt`

**Step 1: Create test file**
```kotlin
package com.audiobookshelf.app.player

import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.common.util.concurrent.MoreExecutors
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class PlayerNotificationServiceTest {

    @Test
    fun serviceBindsAndReturnsSessionToken() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val sessionToken = SessionToken(context,
            android.content.ComponentName(context, PlayerNotificationService::class.java))
        assertNotNull(sessionToken)
    }

    // Additional tests for play/pause/seek will be added as part of 5c implementation
}
```

**Step 2: Add test dependency**
In `build.gradle`:
```groovy
androidTestImplementation "androidx.media3:media3-test-utils:$media3_version"
androidTestImplementation "androidx.test.ext:junit:$androidxJunitVersion"
```

**Step 3: Commit**
```bash
git add android/app/src/androidTest/ android/app/build.gradle
git commit -m "test(media-session): placeholder instrumented tests for Media3 migration (TDD)"
```

---

### Task 5.5: Migrate PlayerNotificationService to Media3 MediaSessionService

**Files:**
- Modify: `android/app/src/main/java/com/audiobookshelf/app/player/PlayerNotificationService.kt`
- Modify: `android/app/src/main/java/com/audiobookshelf/app/player/MediaSessionCallback.kt`
- Modify: `android/app/src/main/java/com/audiobookshelf/app/player/MediaSessionPlaybackPreparer.kt`
- Modify: `android/app/src/main/AndroidManifest.xml`

**Step 1: Read full PlayerNotificationService.kt**
Read the complete 2309-line file to understand the full class structure before modifying.

**Step 2: Update service class declaration**
Replace:
```kotlin
class PlayerNotificationService : MediaBrowserServiceCompat() {
    private var mediaSession: MediaSessionCompat? = null
```
With:
```kotlin
class PlayerNotificationService : MediaSessionService() {
    private var mediaSession: MediaSession? = null
```

Remove: `MediaSessionConnector`, `TimelineQueueNavigator`, `MediaSessionPlaybackPreparer` usage.
Add: `MediaSession.Builder(this, player).build()` in `onCreate()`.

**Step 3: Replace MediaSession lifecycle methods**
- `onGetRoot()` → not needed in `MediaSessionService` (handled by `MediaLibraryService` if Android Auto browsing needed — evaluate and keep `MediaBrowserServiceCompat` as a secondary service if Android Auto is critical, or implement `MediaLibraryService`)
- `onLoadChildren()` → move `BrowseTree` logic to `MediaLibraryService.onGetLibraryRoot()` / `onGetChildren()`
- `sessionToken = mediaSession.sessionToken` → `addSession(mediaSession)`
- `onDestroy()` → `mediaSession?.release(); super.onDestroy()`

**Step 4: Update AndroidManifest.xml**
```xml
<service android:name=".player.PlayerNotificationService"
    android:exported="true"
    android:foregroundServiceType="mediaPlayback">
  <intent-filter>
    <action android:name="androidx.media3.session.MediaSessionService" />
    <action android:name="android.media.browse.MediaBrowserService" />
  </intent-filter>
</service>
```

**Step 5: Build + fix remaining errors**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew compileDebugKotlin --no-daemon 2>&1 | grep "error:" | head -25"'`
Expected: 0 errors. Fix any remaining issues iteratively.

**Step 6: Run all tests**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew testDebugUnitTest --no-daemon 2>&1 | tail -20"'`
Expected: DbManager tests pass, SleepTimerManager tests pass.

**Step 7: Full build**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app/android && ./gradlew clean assembleDebug --no-daemon 2>&1 | tail -10"'`
Expected: BUILD SUCCESSFUL.

**Step 8: Commit + push**
```bash
git add android/app/src/main/ android/app/src/test/ android/app/src/androidTest/
git commit -m "feat(media3): PlayerNotificationService → MediaSessionService, full Media3 migration"
git push origin android/media3-migration
```

**⚠️ MANUAL GATE:** User installs APK, confirms: audio plays, controls work, notifications appear, sleep timer functions.

---

## Branch 6 — `ux/real-server-screenshots`

*Playwright enhancement. Merged after Branch 0 gate passes.*

---

### Task 6.1: Add real-server mode to screenshot script

**Files:**
- Modify: `scripts/screenshot.js`

**Step 1: Read current screenshot.js**
Read the full `scripts/screenshot.js` to understand the current mock setup.

**Step 2: Add env-var detection and real-server path**
At the top of the test file, add:
```js
const SERVER_URL = process.env.ABS_SERVER_URL
const API_TOKEN = process.env.ABS_API_TOKEN
const USE_REAL_SERVER = !!(SERVER_URL && API_TOKEN)
```

In the `beforeAll` (or equivalent setup) where `page.route()` mocks are registered:
```js
if (USE_REAL_SERVER) {
  // Inject credentials, skip all page.route() mocks
  await page.addInitScript(({ url, token }) => {
    localStorage.setItem('AbsToken', token)
    localStorage.setItem('serverAddress', url)
  }, { url: SERVER_URL, token: API_TOKEN })
} else {
  // existing page.route() mock setup unchanged
}
```

**Step 3: Add library item page to real-server path**
When `USE_REAL_SERVER`, after capturing bookshelf screenshot, fetch the first library item ID via the API and capture `item/<id>` page too.

**Step 4: Create helper script**
Create `scripts/screenshot-real.sh`:
```bash
#!/usr/bin/env bash
# Usage: ./scripts/screenshot-real.sh <server-url> <api-token>
export ABS_SERVER_URL="$1"
export ABS_API_TOKEN="$2"
node node_modules/.bin/playwright test scripts/screenshot.js --config playwright.config.js
```
Make it executable: `chmod +x scripts/screenshot-real.sh`

**Step 5: Verify mock mode still works**
Run: `bash -c 'cd /home/lab.abork.co/abork && distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app && /usr/bin/node node_modules/.bin/playwright test scripts/screenshot.js --config playwright.config.js 2>&1"'`
Expected: 5 tests pass (mock mode unchanged).

**Step 6: Commit + push**
```bash
git add scripts/screenshot.js scripts/screenshot-real.sh
git commit -m "feat(screenshots): real-server mode via ABS_SERVER_URL + ABS_API_TOKEN env vars"
git push origin ux/real-server-screenshots
```

---

## Execution Order and Gates

```
Branch 0  (ux/p4-polish)              → ⚠️ SCREENSHOT GATE → user approves
Branch 6  (ux/real-server-screenshots) → can run in parallel with Branch 1
Branch 1  (android/build-modernization)
Branch 2  (android/minsdk-26)
Branch 3  (android/storage-permissions)
Branch 4  (android/platform-hardening)
Branch 5  (android/media3-migration)   → ⚠️ MANUAL APK GATE → user confirms playback
```

Each branch depends on the previous Android branch being merged first (build state accumulates).
Branches 0 and 6 are web-only and can proceed independently of the Android branches.
