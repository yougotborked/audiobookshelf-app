# Audiobookshelf for Podcasts

A fork of the [Audiobookshelf](https://github.com/advplyr/audiobookshelf-app) mobile app, reworked
around **podcast listening** — catching up on new episodes, queueing them, and having them available
offline — with Android Auto and offline use treated as primary cases rather than extras.

**Requires an [Audiobookshelf](https://www.audiobookshelf.org) server to connect to.**

---

## 📲 Download the app

### **[→ Get the latest APK from the Releases page](https://github.com/yougotborked/audiobookshelf-app/releases/latest)**

Every push to `master` publishes a fresh debug APK to the rolling
[`latest` release](https://github.com/yougotborked/audiobookshelf-app/releases/latest). Download the
`audiobookshelf-*.apk` asset and install it.

Notes on installing:

- Android will ask you to allow installing from an unknown source the first time.
- These are **debug** builds, signed with the repo's debug key. The package id is
  `com.audiobookshelf.app.debug`, so it installs alongside the Play Store app rather than replacing it.
- Because the signing key differs from the Play build, you cannot upgrade from the Play version in
  place — install this as a separate app.
- Android only. iOS is not built or released here.

## What's different from upstream

Podcast workflow:

- **Catch up home screen** — a feed of unplayed episodes across your podcast libraries, front and
  centre on the home screen for podcast libraries.
- **Unfinished Podcasts playlist** — an automatic playlist of everything you haven't finished, built
  on the device.
- **Per-podcast rules** — exclude a podcast from the auto playlist entirely, or keep only its latest
  *N* unplayed episodes. Useful when one show's back catalogue would otherwise bury everything else.
- **Auto cache unplayed episodes** (Settings) — downloads unplayed episodes in the background so
  they're ready to play without a connection.
- **Auto continue playlists** (Settings) — rolls on to the next episode automatically.

Android Auto and system media integration:

- Browse and play from Android Auto, with a working queue, skip/seek actions and playback speed.
- Proper media session so lock screen, notification, watch and headset controls all work.

Offline:

- **Disconnect / Continue Offline** — go offline deliberately and keep the normal app around you
  (library layout, Catch up feed, your downloads), rather than dropping to a bare file list.
- Reachability is judged by whether the server actually answered, not by whether the radio is up —
  so plane wifi, captive portals and patchy coverage behave sensibly instead of stalling on timeouts.
- Libraries, playlists and episode lists are cached on the device and used when the server is out of
  reach.

Under the hood this fork has also moved to Nuxt 3 + Pinia and ExoPlayer2 → Media3.

## Contributing

Built with [Nuxt](https://nuxt.com/) and [Capacitor](https://capacitorjs.com/).

See [CLAUDE.md](CLAUDE.md) for the project's build commands and the constraints that matter when
working in this codebase (Pinia-only state, which directories are auto-imported, which legacy files
not to touch).

### Requirements

- [Node.js](https://nodejs.org/en/) — the repo declares 20 (`.nvmrc`, `package.json` engines); CI
  builds on 24, and both work
- Java 21 (Temurin) — required by the Android build (`jvmToolchain(21)`)
- [Android Studio](https://developer.android.com/studio) and the Android SDK

### Build

```shell
npm ci                     # install dependencies
npm run generate           # build the static web app
npx cap sync android       # copy it into the Android project
cd android && ./gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/`.

To open the project in Android Studio instead:

```shell
npx cap open android
```

After changing anything in the JS layer, rebuild and re-sync:

```shell
npm run sync
```

### Checks

```shell
npx vue-tsc --noEmit -p .nuxt/tsconfig.json   # typecheck
cd android && ./gradlew testDebugUnitTest     # Android unit tests
```

Note: the repo carries a number of pre-existing type errors from the Nuxt 2 → 3 migration. Compare
against `master` rather than expecting a clean run.

On every push CI runs Android lint and builds the APK (`staticAnalysis assembleDebug`). It does
**not** run the unit tests, so run `testDebugUnitTest` yourself before pushing. `strings/*.json`
must stay alphabetized — a separate workflow enforces that one.

---

## Credits

All of the hard work belongs to [advplyr](https://github.com/advplyr) and the Audiobookshelf
contributors. This is a personal fork tuned to one podcast-heavy listening habit; if you want the
supported app, use upstream:

- Upstream app: [github.com/advplyr/audiobookshelf-app](https://github.com/advplyr/audiobookshelf-app)
- Server: [github.com/advplyr/audiobookshelf](https://github.com/advplyr/audiobookshelf)
- Project site: [audiobookshelf.org](https://www.audiobookshelf.org)
- Discord: [discord.gg/pJsjuNCKRq](https://discord.gg/pJsjuNCKRq)

Licensed under the same terms as upstream — see [LICENSE](LICENSE).
