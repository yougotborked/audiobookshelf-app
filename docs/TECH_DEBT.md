# Tech debt ledger

Every deliberate compromise that is waiting on something else, with the condition that clears
it. The point is that a workaround taken to unblock an afternoon does not quietly become
permanent: if it is here, it has an exit.

Entries are removed, not ticked off — the git history keeps the record.

## Open

### The watch app's queue arrives only from the catch-up feed

**Where** `components/bookshelf/PodcastCatchUpFeed.vue`

The phone publishes to the watch from one screen. Open Podshelf on any other tab and the watch
is never told anything — on a fresh install it sits on "Open Podshelf on your phone", with no
hint that a particular screen is what it is waiting for.

It lives there because that screen is where the queue is resolved, and resolving it a second
time somewhere else would be the duplicate definition this whole design avoids.

**Clears when** the resolved queue lives somewhere a store can publish from on app start,
rather than being a computed property of one component.

### `android.r8.proguardAndroidTxt.disallowed=false`

**Where** `android/gradle.properties`

AGP 9 turned `getDefaultProguardFile('proguard-android.txt')` from a no-op into a hard
configuration error, because that file carries `-dontoptimize`. Our own modules were moved to
the `-optimize` variant, but twelve Capacitor plugin build files under `node_modules/` still
call the old one, and those are not ours to edit. The flag restores the old behaviour for the
whole build.

It changes nothing for Podshelf today: neither build type enables minification, so no R8
optimization is being given up. The risk is the flag disappearing in a later AGP, which would
make the build un-configurable until the plugins are updated.

**Clears when** every Capacitor plugin we depend on ships an AGP 9 compatible build file. Check
with:

```bash
grep -rl "getDefaultProguardFile('proguard-android.txt')" node_modules/*/android/build.gradle \
  node_modules/*/*/android/build.gradle node_modules/@capacitor/android/capacitor/build.gradle
```

An empty result means the flag can go.

### Capacitor is pinned to 7.x

**Where** `package.json`

Capacitor 8 fixed the proguard call above in core and in the official plugins, so upgrading
would clear most of the entry above on its own. It is not done yet because
`@webnativellc/capacitor-filesharer` has no 8.x release — 7.1.0 is the newest — and its own
build file still calls the removed proguard default. A Capacitor 8 upgrade therefore does not
remove the flag, only shrinks what depends on it.

`FileSharer` is used in exactly three places (`components/stats/YearInReview*.vue`), all
`FileSharer.share()` of a base64 PNG. The replacement, if the plugin stays abandoned, is
`@capacitor/filesystem` to write the file plus `@capacitor/share` to hand off its URI — both
official, both on 8.x.

**Clears when** either filesharer ships an 8.x release, or the three call sites move to
filesystem + share.

### Local network access is asked for at startup, not when it is needed

**Where** `android/app/src/main/java/com/audiobookshelf/app/MainActivity.kt`

`ACCESS_LOCAL_NETWORK` is requested in the startup batch alongside audio and notifications,
rather than at the moment the app first tries to reach a server on the LAN. That shows the
prompt to someone whose server is only ever reachable over the internet and who will never
need it.

It is where it is because a denial is not recoverable in place: without the permission a
connection to a private address does not fail, it times out after six seconds, and the connect
screen has no way to tell that apart from a server that is genuinely down. Asking later would
mean asking after a confusing failure.

**Clears when** the connect flow can resolve the server address off the main thread, notice
that it landed on a private address, and ask then — with a line of explanation attached to the
attempt that needs it.

### The watch plays only what it has downloaded

**Where** `android/wear/src/main/java/com/podshelf/wear/MainActivity.kt`

An episode that has not downloaded yet cannot be played at all, even with the watch sitting on
Wi-Fi. Resolving a stream URL needs a round trip to the server — Audiobookshelf hands out
session-scoped track URLs rather than a stable path per episode — and that does not belong in a
tap handler that has to answer instantly. The row says "Waiting for Wi-Fi" instead of starting
something that would fail a second later.

Offline is the case this feature exists for, so this is the right way round. It is still a gap:
someone who adds an episode and wants it immediately, on Wi-Fi, has to wait for the download
pass rather than just streaming it.

**Clears when** the play path can resolve a stream URL off the main thread and hand the player a
buffering state while it does.

### The watch waits for Wi-Fi rather than offering to find one

**Where** `android/wear/src/main/java/com/podshelf/wear/download/HighBandwidthNetwork.kt`

When no Wi-Fi turns up within the timeout, the download pass gives up and lets WorkManager try
again later. The user is told nothing. Google's guidance is to explain that the feature needs
Wi-Fi and offer a way into the watch's Wi-Fi settings
(`com.google.android.clockwork.settings.connectivity.wifi.ADD_NETWORK_SETTINGS`, which needs
`CHANGE_WIFI_STATE`).

Right now a watch that has never been on Wi-Fi will simply never download, and the queue rows
will say "Waiting for Wi-Fi" indefinitely with no way to act on it.

**Clears when** the watch UI can tell the difference between "downloading shortly" and "this
watch has no Wi-Fi to use", and offers the settings shortcut for the second.

### The watch's idea of the phone's position can be half a minute stale

**Where** `queueNeedsPublishing` in `android/wear-sync/.../WearSync.kt`

The watch decides whether to report its own listening by comparing its record against
`progressUpdatedAtMs` — the timestamp the phone last published. That timestamp rides along with
the position threshold rather than being compared itself, because it moves on every progress
tick and comparing it would wake the watch's radio every few seconds of playback.

So the baseline can be up to one threshold of playback out of date. For that to cause harm, both
devices have to be playing the *same* episode inside the same thirty-second window, and the
watch's write then lands on top of a slightly newer phone position. Two devices playing one
episode at once is already undefined, so this is an edge of an edge — but it is real, and it is
the price of not waking the watch constantly.

**Clears when** the phone also publishes on playback *stopping* — a rare, cheap event — which
would bound the staleness to "since you stopped".

### The Kotlin package is still `com.audiobookshelf.app`

**Where** `android/app/`

Deliberate, and documented in `CLAUDE.md`: nothing outside the build sees it, and renaming a
hundred source files is a large risky diff for no visible gain. Listed here only so nobody
mistakes it for an oversight.

**Clears when** there is an unrelated reason to touch every file in the module anyway.

### 56 pre-existing type errors

**Where** `scripts/typecheck-baseline.json`

Left by the Nuxt 2 → 3 migration. `scripts/typecheck.mjs` fails only on a *new* error, so the
baseline keeps the check useful without a 56-error cleanup blocking everything else. Tighten it
with `npm run typecheck:update` after fixing any of them.

**Clears when** the baseline file is empty.
