#!/usr/bin/env bash
set -euo pipefail

SDK_ROOT=${ANDROID_SDK_ROOT:-/opt/android-sdk}
SDKMANAGER="$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"
CMDLINE_ZIP="commandlinetools-linux-11076708_latest.zip"
CMDLINE_URL="https://dl.google.com/android/repository/${CMDLINE_ZIP}"

ensure_cmdline_tools() {
  if [[ -x "$SDKMANAGER" ]]; then
    return
  fi

  echo "Installing Android command-line tools into $SDK_ROOT" >&2
  mkdir -p "$SDK_ROOT/cmdline-tools"
  tmp_dir=$(mktemp -d)
  pushd "$tmp_dir" >/dev/null
  curl -L -o "$CMDLINE_ZIP" "$CMDLINE_URL"
  unzip -q "$CMDLINE_ZIP"
  mkdir -p "$SDK_ROOT/cmdline-tools/latest"
  mv cmdline-tools/* "$SDK_ROOT/cmdline-tools/latest/"
  popd >/dev/null
  rm -rf "$tmp_dir"
}

install_sdk_packages() {
  local packages=(
    "platform-tools"
    "platforms;android-35"
    "build-tools;35.0.0"
  )

  yes | "$SDKMANAGER" --sdk_root="$SDK_ROOT" --licenses >/dev/null
  "$SDKMANAGER" --sdk_root="$SDK_ROOT" "${packages[@]}"
}

main() {
  ensure_cmdline_tools
  install_sdk_packages
  echo "Android SDK installed at $SDK_ROOT" >&2
}

main "$@"
