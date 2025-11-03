## Audiobookshelf mobile app — agent instructions

This file summarizes the essential, discoverable knowledge to make an AI coding agent productive in this repository.

- Project type: Nuxt (Vue 2) web app packaged with Capacitor for Android/iOS. See `nuxt.config.js` (ssr: false, target: 'static').
- Main directories of interest: `components/`, `pages/`, `plugins/`, `store/`, `assets/`, `android/`, `ios/`, `scripts/`.

Key developer workflows (how to build & debug):
- Local dev (web): `npm install` then `npm run dev` (runs Nuxt on port 1337). See `package.json` scripts.
- Build for native: `npm run generate` then `npx cap sync`. After syncing, open native projects with `npx cap open android` or `npx cap open ios`.
- Quick local CI for Android (mirrors GH action): `npm run ci:android` or pass `-- --fresh` to reinstall dependencies (see `scripts/local-ci.sh`).
- Useful npm scripts: `dev`, `generate`, `sync`, `ci:android`, `devlive` (ionic live reload into device/emulator).

Important code patterns & integration points:
- Auth & API: `plugins/axios.js` is the canonical place for HTTP request shaping, authorization headers, and token refresh logic (it wraps `@nuxtjs/axios`). Use store getters like `user/getToken` and `user/getServerAddress` when inspecting or updating network code.
  - Token refresh uses a single-refresh queue (`isRefreshing`, `failedQueue`). When editing auth logic, preserve the queue flow to avoid duplicate refreshes.
- Local persistence: `plugins/db.js` is used for storing refresh tokens and other cached data. When changing auth storage semantics, update both `plugins/axios.js` and `plugins/db.js`.
- Capacitor/native bridge: Native features live in `plugins/capacitor/*` and `android/` / `ios/`. If code touches native functionality, always run `npx cap sync` and test on device/emulator. Example native bridge: `plugins/capacitor/AbsAudioPlayer.js`.
- UI patterns: components live under `components/` with subfolders (app, bookshelf, cards, etc). Pages are under `pages/`. Components are auto-registered via Nuxt `components: true` in `nuxt.config.js`.
- Localization: translation files are in `strings/` (many language JSONs). Keep keys stable when editing UI text.

Conventions and project-specific notes:
- Node engine: Node 20 is expected (see `package.json` `engines`). Use `nvm use` if the contributor workflow requires it.
- Builds expect Java 21 for Android and a consistent debug keystore (`android/debug.keystore`) — debug builds are signed with it so testers can install updates without uninstalling.
- CSS: Tailwind is used (`assets/tailwind.css`) + PostCSS config in `nuxt.config.js` build.postcss.
- Socket usage: `socket.io-client` is present — search usages when working on realtime features.

When to edit what:
- Prefer editing Nuxt-level code (components, pages, plugins) for UI/UX and API changes.
- Edit native (`android/`, `ios/`) only when implementing or fixing native integration; always document the change and run `npx cap sync` and native build steps.

Examples to reference when coding or proposing changes:
- `nuxt.config.js` — app runtime/target, plugins list and build settings.
- `plugins/axios.js` — authentication, token refresh and request shaping; central to any API-related change.
- `package.json` — scripts like `generate`, `sync`, and `ci:android` useful for dev and CI.
- `strings/` — localization files; changes here require consideration for translators.

Safety and testing notes for agents:
- Preserve token refresh semantics in `plugins/axios.js` (queue + single refresh). Breaking this causes many hard-to-debug auth failures.
- When editing UI text, do not remove translation keys without updating `strings/` and noting the change.

If something is unclear or you need more examples (e.g., where certain API endpoints are used, which Vuex getters exist), ask and I will open the most relevant files (`store/`, `pages/*`, `components/*`) and add example snippets.

-- End of instructions
