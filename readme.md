# Podshelf

A fork of the [Audiobookshelf](https://github.com/advplyr/audiobookshelf-app) mobile app, reworked
around **podcast listening** — catching up on new episodes, queueing them, and having them available
offline — with Android Auto and offline use treated as primary cases rather than extras.

**Requires an [Audiobookshelf](https://www.audiobookshelf.org) server to connect to.** Podshelf is a
client; it does not provide any content of its own.

---

## 📲 Download the app

### **[→ Get the latest APK from the Releases page](https://github.com/yougotborked/audiobookshelf-app/releases/latest)**

### **[→ Or from the test page](https://yougotborked.github.io/audiobookshelf-app/)**

Every push to `master` publishes a fresh debug APK two ways: to the rolling
[`latest` release](https://github.com/yougotborked/audiobookshelf-app/releases/latest), and to a
[test page](https://yougotborked.github.io/audiobookshelf-app/) on GitHub Pages that shows the build
date and commit. Either way, download the `podshelf-*.apk` asset and install it.

Notes on installing:

- Android will ask you to allow installing from an unknown source the first time.
- These are **debug** builds, signed with the repo's debug key, with the package id
  `com.podshelf.app.debug`.
- **Coming from a build before the rename:** Podshelf's application id is `com.podshelf.app`, where
  it used to be `com.audiobookshelf.app`. Android treats a new application id as a different app, so
  this installs alongside the old one rather than upgrading it, and app-private storage does not
  carry over — downloaded episodes have to come down again. Listening progress lives on your server,
  so that survives.
- It also installs alongside upstream's Play Store app rather than replacing it.
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

Large screens and foldables:

- Content stops stretching past 600dp, where Android's medium window size class begins.
- **Tabletop posture** — with a foldable propped open and the hinge across the screen, the player
  lays the artwork out in the pane above the hinge instead of centring it across the hinge.
- The orientation-lock setting disables itself with an explanation on screens where Android 16
  ignores orientation locks, rather than silently doing nothing.

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

One command runs everything CI runs:

```shell
npm run verify             # lint, typecheck, i18n order, JS unit tests, Kotlin unit tests
npm run verify -- --list   # what the steps are
npm run verify all         # the above plus a debug APK
```

Each step also stands alone:

```shell
npm run lint
npm run typecheck          # NOT `npx vue-tsc` — see below
npm run check:i18n         # strings/*.json must stay alphabetized
npm run test:unit          # vitest, plain Node
npm run test:android       # JUnit via Gradle; installs the Android SDK on first run
```

Two things worth knowing:

- **Do not run `npx vue-tsc` or `npx nuxi typecheck`.** Both resolve the latest release, and
  vue-tsc 3.x aborts partway through this project while still printing `Found 0 errors` — a false
  pass that reads exactly like success. `npm run typecheck` pins 2.2.10 and refuses any other major.
- Typecheck runs against a baseline. The Nuxt 2 → 3 migration left pre-existing type errors, so
  `scripts/typecheck.mjs` compares against `scripts/typecheck-baseline.json` and fails only on a
  **new** one. After fixing baselined errors, tighten it with `npm run typecheck:update`.

`npm run verify` works in a bare container — no Android Studio, no preinstalled SDK — so an agent
session or a fresh clone can check its own work rather than pushing to find out.

### Screenshots

```shell
npm run screenshots        # writes docs/screenshots/
```

Boots the app in a headless browser against a fake Audiobookshelf server and captures the main
screens at four widths either side of the 600dp boundary, plus all three themes. It is for looking
at design changes, not a visual-regression suite — nothing is compared against a baseline — but it
does fail if the app did not render, so a blank page is a red test rather than a blank PNG.

### CI

`.github/workflows/build-apk.yml` runs the same checks on every push and pull request:

- **web** — lint, typecheck, i18n order, vitest
- **main** — `staticAnalysis testDebugUnitTest assembleDebug`, and uploads the APK

Two more jobs, **publish** and **release**, are gated to `refs/heads/master` and show as *skipped*
on any other branch. That is expected, not a failure. They deploy the test page and overwrite the
rolling `latest` release.

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
