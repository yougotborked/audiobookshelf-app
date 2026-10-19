#!/usr/bin/env bash
# Compile the Android sources and run the Kotlin unit tests.
#
# This works in a bare container (including Claude Code remote sessions): it installs the
# Android SDK if it is missing and routes dependency resolution through the Maven Central
# mirror, which is what makes Gradle survive the 429s that shared outbound proxies produce.
#
#   scripts/test-android.sh                      compile + run every unit test
#   scripts/test-android.sh '*PauseEventFilter*'  run one test class
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
export ANDROID_HOME="$ANDROID_SDK_ROOT"

if [[ ! -x "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]]; then
  printf '▶ Installing Android SDK into %s (one-off, ~400MB)\n' "$ANDROID_SDK_ROOT"
  scripts/install-android-sdk.sh
fi

# capacitor.settings.gradle points at node_modules/**/android, so the Capacitor plugin
# projects have to be on disk before Gradle can configure the build.
if [[ ! -d node_modules/@capacitor/android ]]; then
  echo "✗ node_modules is missing — run npm ci first." >&2
  exit 1
fi

GRADLE_ARGS=(
  -p android
  --no-daemon
  --init-script "$ROOT_DIR/scripts/gradle-mirror.init.gradle"
  :app:testDebugUnitTest
)

if [[ -n "${1:-}" ]]; then
  GRADLE_ARGS+=(--tests "$1")
fi

printf '▶ ./gradlew %s\n' "${GRADLE_ARGS[*]}"
./android/gradlew "${GRADLE_ARGS[@]}"

RESULTS_DIR="android/app/build/test-results/testDebugUnitTest"
if [[ -d "$RESULTS_DIR" ]]; then
  printf '\n▶ Results\n'
  for xml in "$RESULTS_DIR"/TEST-*.xml; do
    [[ -e "$xml" ]] || continue
    class="$(basename "$xml" .xml)"
    class="${class#TEST-}"
    summary="$(grep -o 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' "$xml" | head -1)"
    printf '  %-70s %s\n' "$class" "$summary"
  done
  printf '\nHTML report: android/app/build/reports/tests/testDebugUnitTest/index.html\n'
fi
