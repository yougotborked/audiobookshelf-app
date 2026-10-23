# Agent instructions

**[CLAUDE.md](../CLAUDE.md) is the maintained copy.** Read it before changing anything.

This file used to describe the app as Nuxt 2 + Vuex, with a `store/` directory, `plugins/axios.js`
for HTTP and `nuxt.config.js`. None of that is true any more — the app is Nuxt 3 + Pinia, state
lives in `stores/` behind named composables, and `this.$store` does not exist. Following the old
version of this file produced code that could not work.

It is deliberately a pointer now. The one-paragraph version:

- Nuxt 3 + Pinia + TypeScript, packaged with Capacitor 7 for Android (iOS is not built here).
- `npm run verify` runs every check CI runs, in a bare container.
- `npm run screenshots` boots the app in a headless browser against a fake server.
- Never run `npx vue-tsc` or `npx nuxi typecheck`; use `npm run typecheck`, which pins the version.

Everything else — the constraints that actually matter — is in CLAUDE.md.
