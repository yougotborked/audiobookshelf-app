# Developing Podshelf

Built with [Nuxt](https://nuxt.com/) and [Capacitor](https://capacitorjs.com/).

See [CLAUDE.md](../CLAUDE.md) for the constraints that matter when working in this codebase —
Pinia-only state, which directories are auto-imported, which legacy files not to touch, and how
colour tokens work.

## Requirements

- [Node.js](https://nodejs.org/en/) — the repo declares 20 (`.nvmrc`, `package.json` engines); CI
  builds on 24, and both work
- Java 21 (Temurin) — required by the Android build (`jvmToolchain(21)`)
- [Android Studio](https://developer.android.com/studio) and the Android SDK

## Build

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

## Checks

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

## Screenshots

```shell
npm run screenshots        # writes docs/screenshots/
```

Boots the app in a headless browser against a fake Audiobookshelf server and captures the main
screens at four widths either side of the 600dp boundary, plus all three themes. It is for looking
at design changes, not a visual-regression suite — nothing is compared against a baseline — but it
does fail if the app did not render, so a blank page is a red test rather than a blank PNG.

## CI

`.github/workflows/build-apk.yml` runs the same checks on every push and pull request:

- **web** — lint, typecheck, i18n order, vitest
- **main** — `staticAnalysis testDebugUnitTest assembleDebug`, and uploads the APK

Two more jobs, **publish** and **release**, are gated to `refs/heads/master` and show as *skipped*
on any other branch. That is expected, not a failure. They deploy the test page and overwrite the
rolling `latest` release.

---

## Where things live

| Kind | Location | Runner |
|------|----------|--------|
| Pure TS logic | `test/*.test.ts` | vitest, plain Node |
| Kotlin / Android | `android/app/src/test/java/...` | JUnit via Gradle |
| Screenshots | `test/e2e/*.spec.ts` | Playwright, `npm run screenshots` |

The extensions matter: `vitest.config.ts` includes `test/**/*.test.ts`, so a Playwright spec has
to be `.spec.ts` or vitest will try to run it without a browser.
