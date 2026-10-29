#!/usr/bin/env bash
# Prints the app's version name and version code, derived from the newest release tag.
#
#   eval "$(scripts/app-version.sh)"   # sets PODSHELF_VERSION_NAME / PODSHELF_VERSION_CODE
#   scripts/app-version.sh --name      # just the name
#
# This lives outside Gradle on purpose. Reading git from variables.gradle looked obvious and
# could not work: `providers.exec` registers a value source that the configuration cache
# re-evaluates when it stores the entry - outside any try/catch around it - so on a shallow
# clone with no tags, which is exactly what CI checks out by default, the whole build failed
# with "finished with non-zero exit value 128" and no amount of catching helped.
#
# So the build takes the version from the environment, and deciding it is a shell problem.
set -euo pipefail

name=""
if tag=$(git describe --tags --abbrev=0 --match='v[0-9]*' 2>/dev/null); then
  name="${tag#v}"
fi

# An obviously wrong version beats a plausibly stale one: nobody reports "0.0.0-untagged" as
# their version and wonders why the fix is missing, which is precisely what 0.12.0-beta did for
# weeks after 0.13.0 shipped.
if [[ -z "$name" ]]; then
  name="0.0.0-untagged"
  code="1"  # AGP rejects a versionCode of 0
else
  IFS='.' read -r major minor patch <<< "${name%%-*}"
  # Same arithmetic as the publish workflow, so a debug build never looks newer than the
  # release it came from.
  code=$(( ${major:-0} * 10000 + ${minor:-0} * 100 + ${patch:-0} ))
fi

case "${1:-}" in
  --name) printf '%s\n' "$name" ;;
  --code) printf '%s\n' "$code" ;;
  *)
    printf 'PODSHELF_VERSION_NAME=%s\n' "$name"
    printf 'PODSHELF_VERSION_CODE=%s\n' "$code"
    ;;
esac
