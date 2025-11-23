#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
GRADLE_USER_HOME="${GRADLE_USER_HOME:-/opt/gradle}"
JAVA_HOME_DEFAULT="/usr/lib/jvm/java-17-openjdk-amd64"
JAVA_HOME="${JAVA_HOME:-$JAVA_HOME_DEFAULT}"
GRADLE_WRAPPER_FILE="$ROOT_DIR/android/gradle/wrapper/gradle-wrapper.properties"
GRADLE_WRAPPER="$ROOT_DIR/android/gradlew"

log() {
  printf "==> %s\n" "$*"
}

sudo_cmd() {
  if [[ $EUID -ne 0 ]]; then
    echo "sudo"
  fi
}

APT_UPDATED=false

ensure_package() {
  local package="$1"
  if command -v dpkg >/dev/null 2>&1 && ! dpkg -s "$package" >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
      if [[ "$APT_UPDATED" == false ]]; then
        $(sudo_cmd) apt-get update -y
        APT_UPDATED=true
      fi
      log "Installing missing package: $package"
      $(sudo_cmd) apt-get install -y "$package"
    else
      log "Package manager not available to install $package."
    fi
  fi
}

ensure_tooling() {
  ensure_package curl
  ensure_package unzip
  ensure_package tar

  if ! command -v javac >/dev/null 2>&1; then
    ensure_package openjdk-17-jdk
  fi

  if command -v javac >/dev/null 2>&1 && [[ -z "${JAVA_HOME:-}" ]]; then
    JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"
  fi
}

read_gradle_version() {
  sed -n 's/^distributionUrl=.*gradle-\([0-9.]*\)-.*/\1/p' "$GRADLE_WRAPPER_FILE"
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

ensure_debug_keystore() {
  local keystore_source="$ROOT_DIR/android/debug.keystore"
  local keystore_target="$HOME/.android/debug.keystore"

  if [[ -f "$keystore_source" ]]; then
    mkdir -p "$HOME/.android"
    cp "$keystore_source" "$keystore_target"
    log "Ensured Android debug keystore is available at $keystore_target"
  fi
}

main() {
  log "Preparing codex Android environment"
  ensure_tooling
  mkdir -p "$ANDROID_SDK_ROOT" "$GRADLE_USER_HOME"

  ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT" "$ROOT_DIR/scripts/install-android-sdk.sh"
  prefetch_gradle_distribution
  ensure_debug_keystore

  cat <<EOF_SUMMARY

Environment prepared. Export these variables in Codex:
export ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT"
export GRADLE_USER_HOME="$GRADLE_USER_HOME"
export JAVA_HOME="$JAVA_HOME"
EOF_SUMMARY
}

main "$@"
