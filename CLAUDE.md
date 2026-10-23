# CLAUDE.md

## Build & Dev Commands

All commands must run inside the `audiobookshelf-dev` distrobox (Ubuntu container):

```bash
distrobox enter audiobookshelf-dev -- bash -c "cd ~/workspace/audiobookshelf-app && COMMAND"
```

| Task | Command |
|------|---------|
| Dev server | `npm run dev` → nuxi dev on `0.0.0.0:1337` |
| Static build | `npm run generate` |
| Run every local check | `npm run verify` (see **Verification** below) |
| TypeScript check | `npm run typecheck` — **not** `npx nuxi typecheck` or `npx vue-tsc` |
| JS unit tests | `npm run test:unit` (`test:unit:watch` to watch) |
| Kotlin unit tests | `npm run test:android` |
| Screenshots of the app | `npm run screenshots` → `docs/screenshots/` |
| Full Android debug APK | `npm run generate && npx cap sync android && cd android && ./gradlew assembleDebug --no-daemon` |

Java 21 (Temurin) is required for Android builds (`jvmToolchain(21)` in `build.gradle`).

## Verification

`scripts/verify.sh` (`npm run verify`) runs lint, typecheck, the i18n sort check, the JS unit
tests and the Kotlin unit tests, and prints a pass/fail summary. `scripts/verify.sh --list` shows the
steps; `scripts/verify.sh all` adds the debug APK. Every step works in a bare container —
no distrobox, no preinstalled Android tooling — so an agent session can verify its own work
instead of pushing to find out.

**Run it before pushing.** CI (`.github/workflows/build-apk.yml`) runs the same checks: the
`web` job does lint + typecheck + i18n + vitest, the `main` job does `staticAnalysis
testDebugUnitTest assembleDebug`. Its `publish` and `release` jobs are gated to
`refs/heads/master` and show as **skipped** on every other branch — that is the gate, not a
failure.

### Seeing the app

`npm run screenshots` boots the real app in headless Chromium against a fake Audiobookshelf
server (`test/e2e/fixtures/`) and captures the main screens at four widths either side of the
600dp boundary plus all three themes. Use it before claiming a layout or theming change works.

It is not a visual-regression suite — nothing is compared against a baseline — but
`expectAppRendered` fails on an empty body or any uncaught exception, so a boot failure is a red
test instead of a blank PNG. That assertion is the whole point: the previous harness wrote an
image whether or not anything had rendered, which let it sit broken for months.

Two things that bit before and will again:

- The fake server lives on **its own origin** (`http://abs-mock.test`). Matching API calls with
  `**/api/**` also matches the dev server's own modules — one of them is
  `/_nuxt/node_modules/@vue/devtools-api/lib/esm/api/index.js` — and serving that as JSON kills
  the module graph, blanking every screenshot.
- Shots are **viewport-sized, not `fullPage`**. The shelves window their rows, so `fullPage`
  stretches past anything that was ever rendered and writes out half-built rows below the fold:
  an image that reads as a layout bug and is not one.

### Where tests go

| Kind | Location | Runner |
|------|----------|--------|
| Pure TS logic | `test/*.test.ts` | vitest, plain Node |
| Kotlin / Android | `android/app/src/test/java/...` | JUnit via Gradle |
| Screenshots | `test/e2e/*.spec.ts` | Playwright, `npm run screenshots` |

The extensions matter: `vitest.config.ts` includes `test/**/*.test.ts`, so a Playwright spec must
be `.spec.ts` or vitest will try to run it without a browser.

`vitest.config.ts` aliases the Capacitor modules to `test/stubs/capacitor.ts`, so a composable
can be imported for its pure exports without a native bridge. There is deliberately no
component-test setup: the bugs in this repo have been in decision logic — what counts as
finished, whether a request reached the server, how long to wait before retrying — not in
rendering.

**Make a fix testable, then test it.** Most of the bugs here were a rule buried where nothing
could reach it: a threshold inlined at four call sites, reachability inferred from error text,
a pause discarded inside a listener callback. Pulling the rule into a named pure function and
testing it is what stops the same bug coming back on a different screen. A test that cannot
fail is worth nothing — reintroduce the bug, watch the test go red, then put the fix back.

### Kotlin changes are verifiable locally

`npm run test:android` compiles the Android sources and runs `android/app/src/test`. It
installs the Android SDK into `/opt/android-sdk` on first run (~400MB) and applies
`scripts/gradle-mirror.init.gradle`.

That init script exists because Maven Central answers **429 Too Many Requests** through
shared outbound proxies, and Gradle treats a 429 as a hard repository failure — one
throttled request fails the whole build. The script puts Google's Maven Central mirror
first. It is applied explicitly, never wired into the build, so CI still resolves from the
canonical repositories.

**Put player logic in a pure function so it can be tested.** Decisions that currently sit
inside `Player.Listener` callbacks need a live player and cannot be exercised. Extracting
the condition into a named pure function next to its caller — as
`player/PauseEventFilter.kt` does for `PlayerListener.onIsPlayingChanged` — makes the rule
testable and puts the reasoning somewhere it can be read. Prefer that over commenting a
condition in place.

### Typecheck runs against a baseline

The Nuxt 2 → 3 migration left pre-existing type errors (56 at the time of writing), so a
bare `vue-tsc` run always fails and gets ignored. `scripts/typecheck.mjs` compares against
`scripts/typecheck-baseline.json` and fails only on a **new** error. Entries are keyed by
file + error code + message, not line number, so edits above an error do not look new.

After fixing baselined errors, tighten the baseline with `npm run typecheck:update`.

**Never run `npx vue-tsc` or `npx nuxi typecheck`.** Both resolve the latest release.
vue-tsc 3.x aborts partway through this project and still prints `Found 0 errors` — a false
pass that reads exactly like success. `vue-tsc` is pinned to 2.2.10 in `devDependencies`,
and `scripts/typecheck.mjs` refuses to run on any other major.

## App identity

The app is **Podshelf**; the server it talks to is **Audiobookshelf**. Keep that distinction when
touching strings: every user-facing string mentioning Audiobookshelf is about the *server* and
should stay.

- `applicationId` is `com.podshelf.app` (`.debug` suffix on debug builds). This is permanent once
  anything is published.
- The **Kotlin package and the gradle `namespace` are still `com.audiobookshelf.app`** on purpose.
  Nothing outside the build sees them, and renaming a hundred source files is a large risky diff
  for no visible gain. Do not "fix" this.
- The mark lives in `design/podshelf-mark.svg` (master, with the reasoning and the two joint
  alignments that are wrong if you redraw it carelessly), `components/ui/PodshelfMark.vue` (in-app,
  takes `currentColor`), `static/logo.svg` (for anything that can only load a file) and
  `android/app/src/main/res/drawable/ic_launcher_foreground.xml` (the adaptive icon). Change one,
  change all four.

## Theming

Colour lives in `assets/tailwind.css` as Material 3 token sets: a `:root` default (dark) plus
`html[data-theme='black']` and `html[data-theme='light']` overrides.

**A theme must restate the whole tonal set, not just the backgrounds.** The light theme used to
override surfaces and text but no primary role, so `--md-primary-container` and friends kept their
dark-theme values — the nav pill rendered dark green on near-white and the mark-as-finished
control was invisible. Nothing catches this but looking at it, which is what
`npm run screenshots` is for.

The accent carries one meaning — where you are in something — so it belongs on progress, the
current item and the play control, and not on decoration.

## Critical Constraints

**State management — Pinia only, not Vuex.**
`this.$store` does not exist. Use named store composables: `useAppStore()`, `useUserStore()`, `useGlobalsStore()`, `useLibrariesStore()`, etc.

**Never edit legacy Nuxt 2 files.**
`pages/**/_id.vue` and `pages/**/_id/**` are in `nuxt.config.ts` `ignore` list — kept for reference only.

**Never add files under `plugins/capacitor/`.**
That directory is in `ignore` — Nuxt will not auto-scan it. Capacitor is bootstrapped via the explicit plugin list in `nuxt.config.ts`.

**Component naming uses path-prefix convention.**
`components/connection/ServerConnectForm.vue` is referenced as `<connection-server-connect-form>`.

**Public assets dir is `static/`, not `public/`.**
Configured via `dir: { public: 'static' }` in `nuxt.config.ts`.

**Auto-import dirs:** `stores/`, `composables/`, `constants/` — no explicit imports needed for files in these directories.

**The Nuxt 2→3 migration is still in progress.** Do not revert to Nuxt 2 / Vuex patterns.

**ESLint needs its parser chain intact.** `.eslintrc.cjs` sets `parser: 'vue-eslint-parser'`
with `parserOptions.parser: '@typescript-eslint/parser'`. Without both, every
`<script setup lang="ts">` block fails to parse and the lint run degrades into 100+ "Parsing
error" messages that hide real findings — which is how it sat for most of the migration.
`no-extra-semi` is off on purpose: `.prettierrc` sets `"semi": false`, so Prettier emits the
leading `;(` that the rule flags.
