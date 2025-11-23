#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
GRADLE_USER_HOME="${GRADLE_USER_HOME:-/opt/gradle}"
JAVA_HOME_DEFAULT="/usr/lib/jvm/java-17-openjdk-amd64"
JAVA_HOME="${JAVA_HOME:-$JAVA_HOME_DEFAULT}"
GRADLE_WRAPPER_FILE="$ROOT_DIR/android/gradle/wrapper/gradle-wrapper.properties"
GRADLE_WRAPPER="$ROOT_DIR/android/gradlew"
SDKMANAGER="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"

log() {
  printf "==> %s\n" "$*"
}

usage() {
  cat <<'USAGE'
Usage: scripts/maintenance.sh [--sdk-only|--gradle-only]

Refreshes the cached Android SDK packages and Gradle wrapper distribution used
by Codex so builds can run offline.

Options:
  --sdk-only      Only update SDK packages and licenses.
  --gradle-only   Only prefetch/prune Gradle distributions.
  --help          Show this message.
USAGE
}

read_gradle_version() {
  sed -n 's/^distributionUrl=.*gradle-\([0-9.]*\)-.*/\1/p' "$GRADLE_WRAPPER_FILE"
}

require_sdkmanager() {
  if [[ ! -x "$SDKMANAGER" ]]; then
    log "sdkmanager not found at $SDKMANAGER. Run scripts/setup.sh first."
    exit 1
  fi
}

refresh_sdk() {
  require_sdkmanager
  log "Accepting Android SDK licenses"
  yes | "$SDKMANAGER" --sdk_root="$ANDROID_SDK_ROOT" --licenses >/dev/null

  log "Updating installed SDK packages"
  "$SDKMANAGER" --sdk_root="$ANDROID_SDK_ROOT" --update

  log "Ensuring required SDK packages are present"
  "$SDKMANAGER" --sdk_root="$ANDROID_SDK_ROOT" \
    "platform-tools" \
    "platforms;android-35" \
    "build-tools;35.0.0"
}

prefetch_gradle_distribution() {
  local gradle_version
  gradle_version="$(read_gradle_version)"

  if [[ -z "$gradle_version" ]]; then
    log "Unable to determine Gradle wrapper version; skipping prefetch."
    return
  fi

  if [[ ! -x "$GRADLE_WRAPPER" ]]; then
    log "Gradle wrapper not found at $GRADLE_WRAPPER; skipping prefetch."
    return
  fi

  log "Prefetching Gradle ${gradle_version} distribution into $GRADLE_USER_HOME"
  ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT" \
    GRADLE_USER_HOME="$GRADLE_USER_HOME" \
    JAVA_HOME="$JAVA_HOME" \
    "$GRADLE_WRAPPER" --no-daemon --version >/dev/null
}

prune_gradle_distributions() {
  local gradle_version gradle_dist_dir
  gradle_version="$(read_gradle_version)"
  gradle_dist_dir="$GRADLE_USER_HOME/wrapper/dists"

  if [[ -z "$gradle_version" || ! -d "$gradle_dist_dir" ]]; then
    return
  fi

  log "Pruning Gradle distributions that are not gradle-${gradle_version}-all"
  find "$gradle_dist_dir" -mindepth 1 -maxdepth 1 -type d ! -name "gradle-${gradle_version}-all" -exec rm -rf {} +
}

main() {
  local sdk_task=true gradle_task=true

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --sdk-only)
        gradle_task=false
        ;;
      --gradle-only)
        sdk_task=false
        ;;
      --help)
        usage
        exit 0
        ;;
      *)
        usage
        exit 1
        ;;
    esac
    shift
  done

  mkdir -p "$ANDROID_SDK_ROOT" "$GRADLE_USER_HOME"

  if $sdk_task; then
    refresh_sdk
  fi

  if $gradle_task; then
    prefetch_gradle_distribution
    prune_gradle_distributions
  fi

  log "Maintenance complete. Current settings:"
  cat <<EOF
ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT
GRADLE_USER_HOME=$GRADLE_USER_HOME
JAVA_HOME=$JAVA_HOME
EOF
}

main "$@"
