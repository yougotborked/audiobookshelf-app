# Tech debt ledger

Every deliberate compromise that is waiting on something else, with the condition that clears
it. The point is that a workaround taken to unblock an afternoon does not quietly become
permanent: if it is here, it has an exit.

Entries are removed, not ticked off — the git history keeps the record.

## Open

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

### The watch does not download episodes

**Where** `android/wear/`

The roadmap's goal for the watch is that a run does not need the phone. The queue and the
credentials are cached on the watch, so the watch can start playback by itself — but the audio
still streams. On a watch with no LTE and no phone in range, that is not standalone.

**Clears when** the watch caches the next few episodes' audio locally, which needs a download
manager on the watch side and a policy for when to fetch (charging + Wi-Fi, most likely).

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
