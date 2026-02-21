#!/usr/bin/env bash
set -euo pipefail

# Source this file from other scripts to make Gradle use Java 21 in Codex.

codex_resolve_java_home() {
  local requested_major="${1:-21}"

  if command -v mise >/dev/null 2>&1; then
    if mise where "java@${requested_major}" >/dev/null 2>&1; then
      mise where "java@${requested_major}"
      return 0
    fi
  fi

  if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/java" ]]; then
    "${JAVA_HOME}/bin/java" -version 2>&1 | head -n 1 | grep -q "\"${requested_major}" && {
      printf '%s\n' "$JAVA_HOME"
      return 0
    }
  fi

  if command -v javac >/dev/null 2>&1; then
    local detected_home
    detected_home="$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"
    if "${detected_home}/bin/java" -version 2>&1 | head -n 1 | grep -q "\"${requested_major}"; then
      printf '%s\n' "$detected_home"
      return 0
    fi
  fi

  return 1
}

codex_use_java21() {
  local java_home
  if java_home="$(codex_resolve_java_home 21)"; then
    export JAVA_HOME="$java_home"
    export PATH="$JAVA_HOME/bin:$PATH"
    return 0
  fi

  if command -v mise >/dev/null 2>&1; then
    mise install -y "java@21"
    java_home="$(mise where java@21)"
    export JAVA_HOME="$java_home"
    export PATH="$JAVA_HOME/bin:$PATH"
    return 0
  fi

  echo "Unable to locate Java 21. Please install Java 21 or install mise." >&2
  return 1
}


codex_run_with_java21() {
  if command -v mise >/dev/null 2>&1; then
    mise exec java@21 -- "$@"
    return $?
  fi

  codex_use_java21
  "$@"
}
