#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

run_step() {
  local description="$1"
  shift
  printf '\n▶ %s\n' "$description"
  "$@"
}

if [[ "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: scripts/local-ci.sh [--fresh]

Runs the same steps as the Build APK GitHub Action, plus local linting.

Options:
  --fresh   Run npm ci before executing the rest of the pipeline.
USAGE
  exit 0
fi

if [[ "${1:-}" == "--fresh" ]]; then
  run_step "Installing dependencies with npm ci" npm ci
fi

run_step "Running ESLint" npm run lint
run_step "Generating static Nuxt bundle" npm run generate
run_step "Synchronising Capacitor project" npx cap sync
run_step "Running Android static analysis" ./android/gradlew staticAnalysis -p android --no-daemon

if [[ -f "android/debug.keystore" ]]; then
  printf '\n▶ Ensuring Android debug keystore is available\n'
  mkdir -p "$HOME/.android"
  cp "android/debug.keystore" "$HOME/.android/debug.keystore"
fi

run_step "Assembling debug APK" ./android/gradlew assembleDebug -p android --no-daemon

cat <<'DONE'

All steps completed. The debug APK can be found under
android/app/build/outputs/apk/debug/.
DONE
