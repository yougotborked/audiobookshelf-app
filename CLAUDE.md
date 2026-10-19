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
testDebugUnitTest assembleDebug`.

### Where tests go

| Kind | Location | Runner |
|------|----------|--------|
| Pure TS logic | `test/*.test.ts` | vitest, plain Node |
| Kotlin / Android | `android/app/src/test/java/...` | JUnit via Gradle |

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
