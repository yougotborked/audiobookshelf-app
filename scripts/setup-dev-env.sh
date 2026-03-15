#!/usr/bin/env bash
# Setup script for audiobookshelf-app Android dev environment
# Run inside the audiobookshelf-dev distrobox container
set -euo pipefail

ANDROID_HOME_DIR="$HOME/.android-sdk"
NODE_VERSION="20"

echo "==> [1/6] Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends \
    openjdk-17-jdk \
    wget curl unzip git ca-certificates \
    gnupg lsb-release \
    2>&1

echo "==> [2/6] Installing Node.js ${NODE_VERSION}..."
if ! command -v node &>/dev/null || [[ "$(node --version | cut -d. -f1 | tr -d 'v')" -lt "$NODE_VERSION" ]]; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "    Node: $(node --version)  npm: $(npm --version)"

echo "==> [3/6] Installing Android SDK command-line tools..."
mkdir -p "$ANDROID_HOME_DIR/cmdline-tools"
if [ ! -d "$ANDROID_HOME_DIR/cmdline-tools/latest" ]; then
    CMDLINE_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
    wget -q --show-progress "$CMDLINE_URL" -O /tmp/cmdline-tools.zip
    unzip -q /tmp/cmdline-tools.zip -d /tmp/cmdline-tools-extract
    mv /tmp/cmdline-tools-extract/cmdline-tools "$ANDROID_HOME_DIR/cmdline-tools/latest"
    rm -rf /tmp/cmdline-tools.zip /tmp/cmdline-tools-extract
fi

echo "==> [4/6] Setting up Android SDK environment variables..."
# Write to .bashrc if not already there
ANDROID_ENV_BLOCK='
# Android SDK
export ANDROID_HOME="$HOME/.android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/35.0.0:$PATH"
'
if ! grep -q 'ANDROID_HOME="\$HOME/.android-sdk"' ~/.bashrc 2>/dev/null; then
    echo "$ANDROID_ENV_BLOCK" >> ~/.bashrc
fi
export ANDROID_HOME="$ANDROID_HOME_DIR"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/35.0.0:$PATH"

echo "==> [5/6] Accepting licenses and installing SDK packages..."
yes | sdkmanager --licenses > /dev/null 2>&1 || true
sdkmanager \
    "platform-tools" \
    "build-tools;35.0.0" \
    "platforms;android-35" \
    "extras;android;m2repository" \
    "extras;google;m2repository"

echo "==> [6/6] Installing npm dependencies..."
cd ~/workspace/audiobookshelf-app
npm install

echo ""
echo "============================================================"
echo "  Dev environment setup complete!"
echo "  Next steps:"
echo "    cd ~/workspace/audiobookshelf-app"
echo "    npm run sync          # build web + capacitor sync"
echo "    cd android && ./gradlew assembleDebug"
echo "============================================================"
