# Agent Instructions

- Always run `scripts/install-android-sdk.sh` before executing any Gradle task (including `./gradlew staticAnalysis`) so the Android SDK is ready and the first Gradle run does not fail in fresh containers.
- Always run `npm run lint` and `cd android && ./gradlew --no-daemon staticAnalysis` before committing changes or creating a PR.
- Report the results of these commands in the testing section of the final response.
