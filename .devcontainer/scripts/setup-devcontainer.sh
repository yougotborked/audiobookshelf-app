#!/usr/bin/env bash
set -euo pipefail

echo "Running devcontainer setup: installing npm deps and Android SDK packages"

export ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT:-/opt/android-sdk}
export PATH=$PATH:${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools

# Install npm deps (prefer CI for reproducible installs)
if [ -f package-lock.json ]; then
  npm ci || true
else
  npm install || true
fi

echo "Installing Android SDK packages (this may take several minutes and download ~ a few hundred MB)"

# Wait for sdkmanager to exist
if [ ! -x "${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "sdkmanager not found at ${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager"
  ls -la ${ANDROID_SDK_ROOT}/cmdline-tools || true
  exit 1
fi

SDKMANAGER="${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager"

# Accept licenses and install required packages for compileSdkVersion 35
yes | ${SDKMANAGER} --sdk_root=${ANDROID_SDK_ROOT} --install \
  "platform-tools" \
  "platforms;android-35" \
  "build-tools;35.0.0" || true

echo "Accepting Android SDK licenses"
yes | ${SDKMANAGER} --sdk_root=${ANDROID_SDK_ROOT} --licenses || true

echo "Devcontainer setup complete. You can run Android builds with: ./gradlew assembleDebug (in the android/ dir) or npm run ci:android"
