# Agent Instructions

- Always run `npm run lint` and `cd android && ./gradlew --no-daemon staticAnalysis` before committing changes or creating a PR.
- Use `scripts/install-android-sdk.sh` first if the Android SDK or build-tools are missing so static analysis can run in fresh containers.
- Report the results of these commands in the testing section of the final response.
