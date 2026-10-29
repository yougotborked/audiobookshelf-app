#!/usr/bin/env bash
# Prints the app's version name and version code, derived from the newest release tag plus the
# number of commits since it.
#
#   eval "$(scripts/app-version.sh)"   # sets PODSHELF_VERSION_NAME / PODSHELF_VERSION_CODE
#   scripts/app-version.sh --name      # just the name
#   scripts/app-version.sh --code      # just the code
#   scripts/app-version.sh --build     # just the commit count since the tag
#
# This lives outside Gradle on purpose. Reading git from variables.gradle looked obvious and
# could not work: `providers.exec` registers a value source that the configuration cache
# re-evaluates when it stores the entry - outside any try/catch around it - so on a shallow
# clone with no tags, which is exactly what CI checks out by default, the whole build failed
# with "finished with non-zero exit value 128" and no amount of catching helped.
#
# So the build takes the version from the environment, and deciding it is a shell problem.
#
# It is also the *only* implementation. The publish workflow used to repeat the arithmetic
# inline, with a comment asking the two copies to be kept in step; they are now one copy,
# because the cost of them drifting is a versionCode Play has already seen, and Play will
# never let that number be reused.
#
# The scheme, and why there is a build component at all:
#
#   code = (major * 10000 + minor * 100 + patch) * 1000 + commits-since-tag
#
#   v0.13.0 exactly        -> 0.13.0           -> 1300000
#   72 commits after it    -> 0.13.0-dev.72    -> 1300072
#   v0.14.0 exactly        -> 0.14.0           -> 1400000
#
# Every push to master publishes to Play's internal track, so a release build happens far more
# often than a tag and each one needs a code of its own - Play rejects a versionCode it has
# already seen. Multiplying the semver part by 1000 leaves room for 999 builds between tags
# while keeping the ordering: any master build after a tag sorts above that tag, and the next
# tag sorts above every master build that preceded it. That ordering is the thing that matters,
# because Play will not accept an upload that is lower than what the track already has.
set -euo pipefail

tag=""
if found=$(git describe --tags --abbrev=0 --match='v[0-9]*' 2>/dev/null); then
  tag="$found"
fi

# An obviously wrong version beats a plausibly stale one: nobody reports "0.0.0-untagged" as
# their version and wonders why the fix is missing, which is precisely what 0.12.0-beta did for
# weeks after 0.13.0 shipped.
if [[ -z "$tag" ]]; then
  name="0.0.0-untagged"
  code="1"  # AGP rejects a versionCode of 0
  build="0"
else
  base="${tag#v}"
  core="${base%%-*}"

  # Reject anything that is not major.minor.patch - a malformed tag would otherwise produce a
  # nonsense versionCode that Play would accept and then never let us go below.
  if ! [[ "$core" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    echo "app-version: tag '$tag' is not v<major>.<minor>.<patch>" >&2
    exit 1
  fi
  major="${BASH_REMATCH[1]}"; minor="${BASH_REMATCH[2]}"; patch="${BASH_REMATCH[3]}"

  # Two digits each for minor and patch, so 1.2.3 -> 10203 and ordering follows semver.
  if [ "$minor" -gt 99 ] || [ "$patch" -gt 99 ]; then
    echo "app-version: minor and patch must each be <= 99 for the versionCode scheme" >&2
    exit 1
  fi

  build=$(git rev-list --count "$tag..HEAD" 2>/dev/null || echo 0)

  # Wrapping would hand Play a code it has already seen, so stop instead. Tag a release; the
  # counter starts over above the tag.
  if [ "$build" -gt 999 ]; then
    echo "app-version: $build commits since $tag exceeds the 999 the scheme allows - tag a release" >&2
    exit 1
  fi

  if [ "$build" -eq 0 ]; then
    name="$base"
  else
    name="${base}-dev.${build}"
  fi
  code=$(( (major * 10000 + minor * 100 + patch) * 1000 + build ))
fi

case "${1:-}" in
  --name)  printf '%s\n' "$name" ;;
  --code)  printf '%s\n' "$code" ;;
  --build) printf '%s\n' "$build" ;;
  *)
    printf 'PODSHELF_VERSION_NAME=%s\n' "$name"
    printf 'PODSHELF_VERSION_CODE=%s\n' "$code"
    ;;
esac
