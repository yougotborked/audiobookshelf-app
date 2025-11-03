#!/usr/bin/env bash
set -euxo pipefail

# System deps often needed by Android/Gradle & native node modules
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  ca-certificates git unzip zip wget curl jq gpg libstdc++6 lib32stdc++6 \
  build-essential python3 make pkg-config openjdk-17-jdk-headless

# Android SDK (cmdline-tools) install
ANDROID_DIR="/opt/android-sdk"
CMDLINE_VER="11076708" # current stable cmdline-tools version number (Google)
sudo mkdir -p "${ANDROID_DIR}/cmdline-tools"
cd /tmp
wget -q https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_VER}_latest.zip -O cmdtools.zip
sudo unzip -q cmdtools.zip -d "${ANDROID_DIR}/cmdline-tools"
sudo mv "${ANDROID_DIR}/cmdline-tools/cmdline-tools" "${ANDROID_DIR}/cmdline-tools/latest"
sudo chown -R vscode:vscode "${ANDROID_DIR}"

# Accept licenses & install platforms/build-tools used by modern Gradle configs
export ANDROID_SDK_ROOT="${ANDROID_DIR}"
yes | "${ANDROID_DIR}/cmdline-tools/latest/bin/sdkmanager" --licenses
"${ANDROID_DIR}/cmdline-tools/latest/bin/sdkmanager" \
  "platform-tools" \
  "platforms;android-34" \
  "platforms;android-33" \
  "build-tools;34.0.0" \
  "build-tools;33.0.2" \
  "extras;google;m2repository" \
  "extras;android;m2repository"

# Node: already provided by feature; ensure corepack/pnpm available if ever needed
corepack enable || true

# Project bootstrap
cd /workspaces/"${LOCAL_WORKSPACE_FOLDER_BASENAME:-audiobookshelf-app}"
if [ -f package-lock.json ] || [ -f package.json ]; then
  npm ci || npm install
fi

# Nuxt generate & Capacitor sync are optional on first boot; leave as tasks
echo "Setup complete."
