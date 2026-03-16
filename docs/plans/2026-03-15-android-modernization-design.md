# Android Modernization + UX Polish — Design Document

**Date:** 2026-03-15
**Project:** audiobookshelf-app (independent fork, Android-only)
**Stack:** NuxtJS 2 + Vue 2 + Tailwind CSS 3 (Capacitor WebView) + Kotlin + ExoPlayer 2 (native Android)

---

## 0. Confirmed Inventory

| Item | Current | Target | Risk |
|---|---|---|---|
| ExoPlayer | `com.google.android.exoplayer2:2.18.7` (legacy) | `androidx.media3:1.5.1` | High — 11 files, 2309-line service |
| MediaSession | `MediaBrowserServiceCompat` + `MediaSessionConnector` | Media3 `MediaSessionService` | High |
| Cast | `exoplayer:extension-cast` | `media3-cast` | Medium |
| PaperDB | `2.7.2` (archived 2021) | `DataStore<Preferences>` | Medium |
| OkHttp | `4.9.2` (CVEs present) | `4.12.0` | Low |
| Jackson | `2.12.2` | `2.18.x` | Low |
| kapt | active (`kotlin-kapt`) | KSP | Low |
| Kotlin version | `2.0.0` in root build.gradle, `2.1.0` in variables.gradle | `2.1.0` everywhere | Trivial |
| minSdk | `24` (Android 7.0) | `26` (Android 8.0) | Trivial |
| Storage perms | `READ/WRITE_EXTERNAL_STORAGE` (deprecated API 33+) | `READ_MEDIA_AUDIO` + SDK gate | Low |
| `foregroundServiceType` | `mediaPlayback` present ✓ | — | None |
| Predictive back | `onBackPressed()` (deprecated) | `OnBackPressedCallback` | Low |
| NavBar pill | Icon-only pill, label below | Pill wraps icon + label | Low (web) |
| Mini player bg | Muddy gradient + raw coverRgb | Surface-4 base + 15% tint | Low (web) |
| `rounded-md-2xl` | Used but undefined | Add to tailwind config | Trivial |

---

## 1. Scope

### In scope
- 6 sequential git branches (Branch 0–5), each independently buildable
- UX/visual bug fixes (web layer) — Branch 0
- Android build system modernization — Branch 1
- minSdk raise — Branch 2
- Storage permissions compliance — Branch 3
- Android 14 platform hardening — Branch 4
- ExoPlayer 2 → Media3 + PaperDB → DataStore — Branch 5
- Real-server screenshot integration for visual gating
- New unit + instrumented tests (TDD gate on branches 3, 4, 5)

### Non-goals
- NuxtJS 2 → Nuxt 3 migration
- iOS support
- Google Play Store submission process
- Push notifications / FCM
- CI/CD pipeline

---

## 2. Branch Sequence and Design

---

### Branch 0 — `ux/p4-polish`
*Web layer only. No Android changes. Screenshot-gated.*

#### 2.0.1 NavBar active pill — wraps icon + label

**Problem:** `BookshelfNavBar.vue` renders the active indicator as `absolute inset-x-4 top-1 h-8` (32px tall). The icon is `h-6` (24px). The label is a separate `<span>` rendered after the icon, sitting below the pill entirely.

**Fix:** Make the pill a flex container that wraps both icon and label as stacked children. Change the pill to a relatively-positioned wrapper (not absolute) using `flex flex-col items-center justify-center` with `rounded-md-full px-4 py-1 bg-md-primary-container`. The inactive tabs show icon-only, no pill.

**Contract:**
```
Active tab:   [pill: icon + label stacked, bg-md-primary-container, rounded-md-full, px-4 py-1]
Inactive tab: [icon only, text-md-on-surface-variant]
```

#### 2.0.2 Mini player background

**Problem:** Mini bar uses `backgroundColor: coverRgb` (full cover art color) + `--gradient-minimized-audio-player: linear-gradient(180deg, transparent → rgb(40,40,40))` overlay. Before cover art loads, `coverRgb = 'rgb(55, 56, 56)'` and the blend is muddy. With light cover art, the mini bar turns white.

**Fix:**
- Mini bar base: `bg-md-surface-4` (class, not style)
- Cover art tint: inline style `backgroundColor: coverRgb` at `opacity: 0.15` on a separate absolutely-positioned child div (like the fullscreen gradient child pattern already used)
- Remove the `--gradient-minimized-audio-player` overlay div entirely
- Keep fullscreen player's gradient system unchanged

**Contract:**
```
Mini bar: surface-4 solid + 15% coverRgb tint overlay (no gradient)
Fullscreen: unchanged (coverRgb full bg + gradient-audio-player overlay)
```

#### 2.0.3 Tailwind shape token — `rounded-md-2xl`

**Problem:** `connect.vue` uses `rounded-md-2xl` but `tailwind.config.js` only defines up to `rounded-md-xl` (28px) and `rounded-md-full`.

**Fix:** Add `'md-2xl': '20px'` to `borderRadius` in `tailwind.config.js`. (20px sits naturally between xl=28px and... actually 20px < 28px, so re-order: xs=4, sm=8, md=12, lg=16, xl=20, 2xl=28, full=9999. Alternatively keep xl=28 and add 2xl=36px.) **Decision:** add `md-2xl: '36px'` as a larger-than-xl shape (2xl is typically larger than xl in Tailwind convention), and update `connect.vue` icon container to use `rounded-md-xl` (28px) which visually looks right for a square icon container.

#### 2.0.4 Settings read-only input focus border

**Problem:** `TextInput.vue` shows green focus border (`border-md-primary border-2`) on read-only inputs in settings (haptic feedback, language, theme dropdowns) when the component receives focus.

**Fix:** In `TextInput.vue`, only set `focused = true` on `@focus` if `!readonly`. Add `v-if` or conditional in the border class: `focused && !readonly`.

#### 2.0.5 Legacy color token cleanup

Audit and replace remaining `text-fg`, `text-fg-muted`, `bg-primary`, `bg-secondary` in:
- `components/app/Appbar.vue` (any remaining)
- `components/home/*.vue` home page section headers
- `pages/bookshelf/index.vue` shelf section titles

Replace with M3 equivalents (`text-md-on-surface`, `text-md-on-surface-variant`, `bg-md-surface-1`, etc.).

**Screenshot gate:** After Branch 0 merges, run Playwright with real server data (if user provides credentials) and present screenshots for visual sign-off before Branch 1 begins.

---

### Branch 1 — `android/build-modernization`
*Zero functional change. Build files only.*

#### Changes
1. **Kotlin version**: Set `kotlin_version = '2.1.0'` in root `build.gradle` (currently `2.0.0`). Remove duplicate definition; `variables.gradle` already has `2.1.0` — make root inherit it.
2. **Remove `kotlinDaemonJvmArgs`**: All 11 `--add-opens=jdk.compiler/...` entries are workarounds no longer needed with Kotlin 2.1 + JDK 21. Remove the `kotlin { kotlinDaemonJvmArgs = [...] }` block entirely.
3. **kapt → KSP**:
   - Replace `id 'kotlin-kapt'` → `id 'com.google.devtools.ksp'` in `app/build.gradle` plugins
   - Replace `kapt "com.github.bumptech.glide:compiler:$glide_version"` → `ksp "com.github.bumptech.glide:ksp:$glide_version"` (Glide has KSP support since 4.14)
   - Add `ksp` version to `variables.gradle`: `ksp_version = '2.1.0-1.0.29'`
   - Add KSP plugin to root `build.gradle` classpath
4. **OkHttp**: `4.9.2` → `4.12.0` in `build.gradle`
5. **Jackson**: `2.12.2` → `2.18.3` in `build.gradle`
6. **Groovy DSL deprecations**: Fix any `findProperty` / `ext.` patterns causing Gradle 8 warnings

**Verification:** `./gradlew clean assembleDebug --no-daemon` passes, lint clean.

---

### Branch 2 — `android/minsdk-26`
*One variable change + API guard cleanup.*

#### Changes
1. `minSdkVersion = 26` in `variables.gradle`
2. Grep all Kotlin files for `Build.VERSION.SDK_INT >= 26` / `@RequiresApi(Build.VERSION_CODES.O)` — remove the SDK check, keep the code unconditionally
3. `AudioFocusRequest` builder (API 26) can be used without compat wrapper
4. `NotificationChannel` creation (API 26) — already used, remove any old `if SDK >= 26` guard

**Verification:** Build clean, no `@RequiresApi(26)` annotations remain, `minifyEnabled false` → APK installs on API 26 emulator.

---

### Branch 3 — `android/storage-permissions`
*Play Store compliance. Independent of media stack.*

#### Changes — AndroidManifest.xml
```xml
<!-- Old (remove for API 33+) -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="29" />

<!-- New -->
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
```

#### Changes — runtime permission request
- Where the app requests `READ_EXTERNAL_STORAGE` at runtime (find via grep), add SDK branch:
  - API 33+: request `READ_MEDIA_AUDIO`
  - API 29–32: request `READ_EXTERNAL_STORAGE`
  - API 26–28: both may be needed for downloads

#### Tests (new, TDD order)
- `PermissionHelperTest.kt`: unit tests for the permission-selection logic (which permission string to request at which SDK level)

**Verification:** Manual test on API 33 emulator, `READ_MEDIA_AUDIO` granted, audio files accessible.

---

### Branch 4 — `android/platform-hardening`
*Android 14 + battery patterns.*

#### 4.1 Predictive back gesture
Replace deprecated `override fun onBackPressed()` in `MainActivity.kt` with `OnBackPressedCallback`:
```kotlin
onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
    override fun handleOnBackPressed() { /* existing logic */ }
})
```

#### 4.2 Edge-to-edge display
In `MainActivity.onCreate()`:
```kotlin
WindowCompat.setDecorFitsSystemWindows(window, false)
ViewCompat.setOnApplyWindowInsetsListener(binding.root) { v, insets ->
    val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
    v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
    insets
}
```
The Capacitor WebView sits full-screen; system bars overlay it. The web layer handles safe-area via CSS `env(safe-area-inset-*)` which Capacitor already injects.

#### 4.3 Wake lock audit
In `SleepTimerManager.kt` and `PlayerNotificationService.kt`:
- Ensure `PARTIAL_WAKE_LOCK` is released in all exit paths: normal expiry, cancel, service destroy, app kill
- Use `try/finally` pattern around wake lock acquisition

#### 4.4 Battery optimization intent
Verify `Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` is requested for the app package on first playback session. If not present, add a one-time prompt.

#### Tests (new, TDD order)
- `SleepTimerManagerTest.kt`: unit tests for set/extend/cancel/fire state machine, including wake lock release verification via mock

**Verification:** Build + manual: back gesture works, player notification shows on Android 14 without foreground service crash.

---

### Branch 5 — `android/media3-migration`
*Three atomic sub-steps, merged as one branch.*

#### 5a — PaperDB → DataStore Preferences

**Step 1 (TDD):** Write `DbManagerTest.kt` — characterization tests capturing current `DbManager` behavior:
- `saveDeviceData / getDeviceData` round-trip
- `saveServerConnectionConfigs / getServerConnectionConfigs` round-trip
- `saveCurrentServerConnectionConfig` stores and retrieves correctly
- Null/missing key returns expected default

**Step 2 (Implementation):**
- Add `androidx.datastore:datastore-preferences:1.1.x` to `build.gradle`
- Replace PaperDB read/write internals in `DbManager.kt` with DataStore
- Keep `DbManager` API surface identical (callers unchanged)
- Use `runBlocking` for synchronous-style reads (acceptable: callers already on background threads)
- Remove `io.github.pilgr:paperdb:2.7.2` from `build.gradle`
- DataStore file is new (`device_prefs.pb`); old PaperDB files auto-orphaned, cleaned on first launch

**Migration note:** DataStore Preferences uses typed keys (`stringPreferencesKey`, `booleanPreferencesKey`). JSON serialization for complex objects (server configs) via Jackson (already a dependency).

#### 5b — ExoPlayer 2 → Media3 import rename

**Dependency changes in `build.gradle`:**
```groovy
// Remove:
implementation "com.google.android.exoplayer:exoplayer-core:$exoplayer_version"
implementation "com.google.android.exoplayer:exoplayer-ui:$exoplayer_version"
implementation "com.google.android.exoplayer:extension-mediasession:$exoplayer_version"
implementation "com.google.android.exoplayer:extension-cast:$exoplayer_version"
implementation "com.google.android.exoplayer:exoplayer-hls:$exoplayer_version"

// Add:
implementation "androidx.media3:media3-exoplayer:$media3_version"
implementation "androidx.media3:media3-ui:$media3_version"
implementation "androidx.media3:media3-session:$media3_version"
implementation "androidx.media3:media3-cast:$media3_version"
implementation "androidx.media3:media3-exoplayer-hls:$media3_version"
```

**Key API differences to fix across 11 files:**

| Old | New |
|---|---|
| `com.google.android.exoplayer2.*` | `androidx.media3.exoplayer.*` |
| `SimpleExoPlayer` | `ExoPlayer` |
| `ExoPlayer.Builder(context).build()` | Same (no change) |
| `AudioAttributes.Builder()` | `androidx.media3.common.AudioAttributes.Builder()` |
| `MediaItem.fromUri(uri)` | Same |
| `HlsMediaSource.Factory` | `androidx.media3.exoplayer.hls.HlsMediaSource.Factory` |
| `ProgressiveMediaSource.Factory` | `androidx.media3.exoplayer.source.ProgressiveMediaSource.Factory` |
| `PlayerNotificationManager` | `androidx.media3.ui.PlayerNotificationManager` |
| `DefaultExtractorsFactory` | `androidx.media3.extractor.DefaultExtractorsFactory` |
| `Mp3Extractor` | `androidx.media3.extractor.mp3.Mp3Extractor` |
| `C.CONTENT_TYPE_*` | `androidx.media3.common.C.*` |

Cast-specific (`CastPlayer.kt`, `CastManager.kt`, `CastTimeline*.kt`):
- `com.google.android.exoplayer2.ext.cast.*` → `androidx.media3.cast.*`
- `SessionAvailabilityListener` → `androidx.media3.cast.SessionAvailabilityListener`

#### 5c — MediaBrowserServiceCompat → Media3 MediaSessionService

**Service declaration change (`AndroidManifest.xml`):**
```xml
<!-- Remove: -->
<service android:name=".player.PlayerNotificationService"
    android:exported="true">
  <intent-filter>
    <action android:name="android.media.browse.MediaBrowserService" />
  </intent-filter>
</service>

<!-- Add: -->
<service android:name=".player.PlayerNotificationService"
    android:exported="true"
    android:foregroundServiceType="mediaPlayback">
  <intent-filter>
    <action android:name="androidx.media3.session.MediaSessionService" />
    <action android:name="android.media.browse.MediaBrowserService" />
  </intent-filter>
</service>
```
(Keep `MediaBrowserService` intent-filter for Android Auto backward compat.)

**`PlayerNotificationService.kt` structural change:**
```kotlin
// Before:
class PlayerNotificationService : MediaBrowserServiceCompat() {
    private var mediaSession: MediaSessionCompat? = null
    private var mediaSessionConnector: MediaSessionConnector? = null

// After:
class PlayerNotificationService : MediaSessionService() {
    private var mediaSession: MediaSession? = null
```

**Replace:**
- `MediaSessionCompat` → `MediaSession` (Media3)
- `MediaSessionConnector` + `TimelineQueueNavigator` + `MediaSessionPlaybackPreparer` → `MediaSession.Callback` (single interface)
- `onGetRoot()` / `onLoadChildren()` (MediaBrowser) → implement `MediaLibraryService` or use `MediaSession` with `BrowseTree` unchanged for Android Auto

**Tests (instrumented, TDD order):**
- `PlayerNotificationServiceTest.kt`: bind service → connect MediaController → play → pause → seek → disconnect → service lifecycle assertions
- Requires emulator with API 26+ and media session support

**Verification:** Build + all `DbManagerTest` + `SleepTimerManagerTest` + `PlayerNotificationServiceTest` green. Manual: play audiobook, scrub, sleep timer, Android Auto connection.

---

## 3. Real-Server Screenshot Integration

**Goal:** `scripts/screenshot.js` uses real ABS server data when env vars are set.

**Design:**
```js
const serverUrl = process.env.ABS_SERVER_URL
const apiToken = process.env.ABS_API_TOKEN
const useRealServer = !!(serverUrl && apiToken)

if (useRealServer) {
  // Skip page.route() mock interceptors
  // Instead inject credentials via addInitScript
  await page.addInitScript(({ url, token }) => {
    window.__abs_server_url = url
    window.__abs_api_token = token
  }, { url: serverUrl, token: apiToken })
} else {
  // existing mock route() behavior
}
```

**Captured pages with real server:**
1. `connect` — pre-auth landing
2. `bookshelf` — home with real library data
3. `bookshelf/library` — book grid with real covers
4. `settings` — same as mock
5. `item/<first-item-id>` — real item detail page (fetch first item from `/api/libraries/<id>/items`)

**Helper script:** `scripts/screenshot-real.sh`
```bash
#!/usr/bin/env bash
export ABS_SERVER_URL="$1"
export ABS_API_TOKEN="$2"
node node_modules/.bin/playwright test scripts/screenshot.js --config playwright.config.js
```

---

## 4. Testing Strategy

| Test type | Location | When added | What it covers |
|---|---|---|---|
| Unit (JVM) | `src/test/kotlin/` | Branches 3, 4, 5a | Permissions, SleepTimer, DbManager |
| Instrumented | `src/androidTest/kotlin/` | Branch 5c | MediaSession lifecycle |
| Visual (Playwright) | `scripts/screenshot.js` | Branch 0 gate | Web layer UI |

**TDD gate:** Characterization tests for `DbManager` are written and passing BEFORE PaperDB internals are touched (Branch 5a).

---

## 5. Screenshot Gates

| After branch | Gate type | Who acts |
|---|---|---|
| Branch 0 | Playwright screenshots presented to user | User approves or requests fixes |
| Branch 1–4 | APK builds clean | Automated (build success) |
| Branch 5 | All new tests green + manual APK smoke test | User installs APK, confirms playback |

---

## 6. Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Media3 `MediaSessionService` breaks Android Auto | Medium | Keep `android.media.browse.MediaBrowserService` intent-filter; test on AA emulator |
| DataStore migration loses existing device settings | Low | DataStore is a new file; old PaperDB data is orphaned not deleted — one-time migration utility reads old PaperDB and writes to DataStore on first launch |
| KSP Glide incompatibility | Low | Glide KSP support mature since 4.14; pin exact KSP plugin version |
| Edge-to-edge breaks WebView layout | Low | Capacitor already handles `safe-area-inset` CSS vars; test on device with cutout |
| minSdk 26 drops users | Very low | ~1-2% of active Android market on API 24-25 |
