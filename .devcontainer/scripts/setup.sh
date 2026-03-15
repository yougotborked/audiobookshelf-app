#!/usr/bin/env bash
set -euxo pipefail

# ---------- Configuration ----------
# Allow overrides from devcontainer.json via containerEnv
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
GRADLE_USER_HOME="${GRADLE_USER_HOME:-/workspaces/.gradle}"
NPM_CACHE_DIR="${NPM_CACHE_DIR:-/workspaces/.npm-cache}"
WORKSPACE_DIR="/workspaces/${LOCAL_WORKSPACE_FOLDER_BASENAME:-audiobookshelf-app}"

# Android components to ensure are present
ANDROID_PLATFORMS=("platforms;android-34" "platforms;android-33")
ANDROID_BUILD_TOOLS=("build-tools;34.0.0" "build-tools;33.0.2")
ANDROID_BASICS=("platform-tools" "extras;google;m2repository" "extras;android;m2repository")

# ---------- Base system deps (for native modules/Gradle) ----------
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  ca-certificates git unzip zip wget curl jq gpg \
  build-essential python3 make pkg-config libstdc++6 lib32stdc++6

# If Java is not present (because a feature/base image might have installed it), install OpenJDK 17 headless.
if ! command -v java >/dev/null 2>&1; then
  sudo apt-get install -y --no-install-recommends openjdk-21-jdk-headless
fi

# ---------- Android SDK: ensure cmdline-tools + permissions ----------
# Prefer any existing sdkmanager on PATH. If found, try to infer the SDK root from
# its location (commonly <sdk_root>/cmdline-tools/latest/bin/sdkmanager). If not
# found on PATH, fall back to the configured ANDROID_SDK_ROOT and install the
# commandline tools there.
SDKMANAGER_BIN=""

if command -v sdkmanager >/dev/null 2>&1; then
  SDKMANAGER_BIN=$(command -v sdkmanager)
  # sdkmanager is usually at <sdk_root>/cmdline-tools/latest/bin/sdkmanager
  INFERRED_ROOT="$(cd "$(dirname "$(dirname "$(dirname "$SDKMANAGER_BIN")")")" && pwd)" || INFERRED_ROOT=""
  if [ -n "$INFERRED_ROOT" ]; then
    echo "Detected sdkmanager at $SDKMANAGER_BIN, inferring SDK root: $INFERRED_ROOT"
    ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$INFERRED_ROOT}"
    ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
  else
    echo "Detected sdkmanager at $SDKMANAGER_BIN but failed to infer SDK root; using ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT"
  fi
else
  if [ -x "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
    SDKMANAGER_BIN="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"
  fi
fi

if [ -z "$SDKMANAGER_BIN" ]; then
  CMDLINE_VER="11076708"  # Google cmdline-tools rev; adjust as needed
  sudo mkdir -p "${ANDROID_SDK_ROOT}/cmdline-tools"
  tmpdir="$(mktemp -d)"
  pushd "$tmpdir"
  wget -q "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_VER}_latest.zip" -O cmdtools.zip
  sudo unzip -q cmdtools.zip -d "${ANDROID_SDK_ROOT}/cmdline-tools"
  sudo mv "${ANDROID_SDK_ROOT}/cmdline-tools/cmdline-tools" "${ANDROID_SDK_ROOT}/cmdline-tools/latest"
  popd
  rm -rf "$tmpdir"
  SDKMANAGER_BIN="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"
fi

# Make SDK tree writable by the vscode user (fixes "Failed to read or create install properties file")
sudo mkdir -p "$ANDROID_SDK_ROOT"
sudo chown -R vscode:vscode "$ANDROID_SDK_ROOT" || true
sudo chmod -R u+rwX,go+rX "$ANDROID_SDK_ROOT" || true

# Pre-create common subdirs to keep sdkmanager happy
mkdir -p \
  "$ANDROID_SDK_ROOT/licenses" \
  "$ANDROID_SDK_ROOT/platforms" \
  "$ANDROID_SDK_ROOT/build-tools" \
  "$ANDROID_SDK_ROOT/platform-tools" \
  "$HOME/.android"

# Add SDK tools to PATH for this script execution and prefer detected sdkmanager
export ANDROID_SDK_ROOT ANDROID_HOME
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$PATH"
if [ -n "$SDKMANAGER_BIN" ]; then
  SDK_DIR_BIN_DIR="$(dirname "$SDKMANAGER_BIN")"
  export PATH="$SDK_DIR_BIN_DIR:$PATH"
fi

# Helper to run sdkmanager with retries (network hiccups happen)
sdkm() {
  local attempt=1 max=4
  local bin
  if [ -n "$SDKMANAGER_BIN" ]; then
    bin="$SDKMANAGER_BIN"
  else
    bin="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"
  fi
  until "$bin" --sdk_root="$ANDROID_SDK_ROOT" "$@"; do
    if [ $attempt -ge $max ]; then
      echo "sdkmanager failed after $attempt attempts: $*" >&2
      exit 1
    fi
    sleep $((attempt * 2))
    attempt=$((attempt + 1))
  done
}

# Accept licenses non-interactively
# ---------- Accept licenses (avoid SIGPIPE with pipefail) ----------
set +o pipefail
yes | sdkm --licenses >/dev/null 2>&1 || true
set -o pipefail

# Install required Android packages
sdkm "${ANDROID_BASICS[@]}"
sdkm "${ANDROID_PLATFORMS[@]}"
sdkm "${ANDROID_BUILD_TOOLS[@]}"

# ---------- Node/npm hygiene (fix EACCES, root-owned cache, partial installs) ----------
# Ensure npm cache is writable and persistent (mounted as a volume in devcontainer.json is ideal)
sudo mkdir -p "$NPM_CACHE_DIR"
sudo chown -R vscode:vscode "$NPM_CACHE_DIR"
mkdir -p "$HOME/.npm"
sudo chown -R vscode:vscode "$HOME/.npm"

# Point npm to the writable cache and clean any prior root-owned junk
npm config set cache "$NPM_CACHE_DIR" --location=global || true
# If previous runs created root-owned files in ~/.npm, fix ownership
sudo chown -R "$(id -u)":"$(id -g)" "$HOME/.npm" || true

# ---------- Gradle cache ----------
sudo mkdir -p "$GRADLE_USER_HOME"
sudo chown -R vscode:vscode "$GRADLE_USER_HOME"

# ---------- Project bootstrap ----------
cd "$WORKSPACE_DIR"

# If node_modules exists but has root-owned content, fix it; otherwise npm will throw TAR_ENTRY/EACCES noise.
if [ -d node_modules ]; then
  sudo chown -R vscode:vscode node_modules || true
fi

# Prefer reproducible install; fall back to npm install if no lockfile present.
if [ -f package-lock.json ]; then
  # Clean partial installs from previous failed attempts but avoid nuking caches
  rm -rf node_modules
  npm ci --no-audit --fund=false || (rm -rf node_modules && npm ci --no-audit --fund=false)
else
  npm install --no-audit --fund=false
fi

# ---------- Optional: sync Capacitor native projects ----------
# Prefer using the `npm run sync` script when available (it's defined in package.json
# as `nuxt generate && npx cap sync`). This keeps the behavior concise and consistent
# with the project's npm scripts. The step is idempotent and will not fail the entire
# setup when it encounters an error; it will warn instead.
if command -v npm >/dev/null 2>&1 && [ -f package.json ]; then
  # Auto-answer Capacitor telemetry prompt by enabling telemetry non-interactively
  # before any `npx cap sync` runs. This prevents the interactive prompt from
  # blocking setup. It's best-effort and non-blocking if the CLI is not present.
  if command -v npx >/dev/null 2>&1; then
    echo "Auto-enabling Capacitor telemetry (non-interactive)..."
    npx cap telemetry on >/dev/null 2>&1 || npx cap telemetry enable >/dev/null 2>&1 || true
  fi

  if npm run | sed -n '1,200p' | grep -q "sync"; then
    echo "Running 'npm run sync' (generate + cap sync)..."
    if ! npm run sync --if-present; then
      echo "Warning: 'npm run sync' failed — native projects may be out of sync. You can run 'npm run sync' manually to retry."
    fi
  else
    # Fallback: if Capacitor deps/config are present but no `sync` script, run npx cap sync directly
    if grep -q "@capacitor" package.json || [ -f capacitor.config.json ]; then
      echo "No 'sync' npm script found; running 'npx cap sync' as a fallback..."
      if ! command -v npx >/dev/null 2>&1 || ! npx cap sync; then
        echo "Warning: 'npx cap sync' failed or npx not available — native projects may be out of sync."
      fi
    fi
  fi
fi

# Optional: enable corepack for pnpm/yarn if ever needed by contributors
corepack enable || true

echo "Setup complete: Android SDK + Node deps installed. Ready for Nuxt/Capacitor/Gradle builds."
