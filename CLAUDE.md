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
| TypeScript check | `npx nuxi typecheck` |
| Full Android debug APK | `npm run generate && npx cap sync android && cd android && ./gradlew assembleDebug --no-daemon` |

Java 21 (Temurin) is required for Android builds (`jvmToolchain(21)` in `build.gradle`).

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

**Active branch is `modernize/nuxt3`** — a Nuxt 2→3 migration in progress. Do not revert to Nuxt 2 / Vuex patterns.
