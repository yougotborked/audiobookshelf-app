# Agent Instructions

**[CLAUDE.md](CLAUDE.md) is the maintained copy.** Read it: build commands, the verification
story, where tests go, and the constraints that will otherwise bite (Pinia only — no Vuex and no
`this.$store`; which directories auto-import; which legacy files not to touch; why `npx vue-tsc`
must never be run).

This file exists so agents that look for `AGENTS.md` find their way there. Keep it a pointer —
three parallel instruction files that each describe the codebase is how they end up contradicting
each other, which is exactly what happened to `.github/copilot-instructions.md`.

## Before committing

Run `npm run verify` — lint, typecheck, i18n order, JS unit tests and Kotlin unit tests, the same
set CI runs. It installs the Android SDK itself on first run, so there is no separate
`scripts/install-android-sdk.sh` step any more.

Report what it printed in the testing section of your final response. If something is unverified,
say so plainly rather than implying it passed.
