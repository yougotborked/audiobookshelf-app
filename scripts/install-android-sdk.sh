#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK_ROOT=${ANDROID_SDK_ROOT:-/opt/android-sdk}
CMDLINE_DIR="$SDK_ROOT/cmdline-tools"
SDKMANAGER="$CMDLINE_DIR/latest/bin/sdkmanager"

# Bootstrap zip. Only used when there is no sdkmanager at all; whatever it contains is then
# immediately asked to update itself, below, so this pin does not decide which SDK packages
# are reachable.
CMDLINE_ZIP="commandlinetools-linux-13114758_latest.zip"
CMDLINE_URL="https://dl.google.com/android/repository/${CMDLINE_ZIP}"

# compileSdk 37 ships as a minor-versioned platform package, not as a bare "android-37".
PLATFORM_PACKAGE="platforms;android-37.0"
BUILD_TOOLS_PACKAGE="build-tools;37.0.0"

ensure_cmdline_tools() {
  if [[ -x "$SDKMANAGER" ]]; then
    return
  fi

  echo "Installing Android command-line tools into $SDK_ROOT" >&2
  mkdir -p "$CMDLINE_DIR"
  tmp_dir=$(mktemp -d)
  pushd "$tmp_dir" >/dev/null
  curl -L -o "$CMDLINE_ZIP" "$CMDLINE_URL"
  unzip -q "$CMDLINE_ZIP"
  mkdir -p "$CMDLINE_DIR/latest"
  mv cmdline-tools/* "$CMDLINE_DIR/latest/"
  popd >/dev/null
  rm -rf "$tmp_dir"
}

# The minor-versioned SDKs (36.1, 37.0, 37.1 ...) are only listed in version 4 of the remote
# repository XML. An sdkmanager older than that parses what it can, warns, and reports the
# platform as simply not existing - "Failed to find package 'platforms;android-37.0'" - which
# reads like a typo rather than a stale tool. So: if the platform we need is not in the
# listing, update the tools once and look again.
update_cmdline_tools_if_platform_invisible() {
  if "$SDKMANAGER" --sdk_root="$SDK_ROOT" --list 2>/dev/null \
      | grep -qE "platforms/${PLATFORM_PACKAGE#platforms;}( |$)"; then
    return
  fi

  echo "sdkmanager cannot see $PLATFORM_PACKAGE; updating the command-line tools" >&2
  # sdkmanager refuses to install over an existing cmdline-tools/latest and puts the new copy
  # in latest-2 instead, so the swap is ours to do.
  rm -rf "$CMDLINE_DIR/latest-2"
  yes | "$SDKMANAGER" --sdk_root="$SDK_ROOT" "cmdline-tools;latest" >/dev/null 2>&1 || true
  if [[ -x "$CMDLINE_DIR/latest-2/bin/sdkmanager" ]]; then
    rm -rf "$CMDLINE_DIR/previous"
    mv "$CMDLINE_DIR/latest" "$CMDLINE_DIR/previous"
    mv "$CMDLINE_DIR/latest-2" "$CMDLINE_DIR/latest"
  fi
}

write_local_properties() {
  local android_dir="$ROOT_DIR/android"
  local local_properties="$android_dir/local.properties"
  if [[ ! -d "$android_dir" ]]; then
    return
  fi

  # Gradle checks sdk.dir in local.properties before env vars in some setups.
  printf 'sdk.dir=%s\n' "$SDK_ROOT" > "$local_properties"
}

install_sdk_packages() {
  local packages=(
    "platform-tools"
    "$PLATFORM_PACKAGE"
    "$BUILD_TOOLS_PACKAGE"
  )

  yes | "$SDKMANAGER" --sdk_root="$SDK_ROOT" --licenses >/dev/null || true
  "$SDKMANAGER" --sdk_root="$SDK_ROOT" "${packages[@]}"
}

main() {
  ensure_cmdline_tools
  update_cmdline_tools_if_platform_invisible
  install_sdk_packages
  write_local_properties
  echo "Android SDK installed at $SDK_ROOT" >&2
}

main "$@"
