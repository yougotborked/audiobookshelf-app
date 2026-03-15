Audiobookshelf devcontainer notes

This devcontainer provides a lightweight environment for editing and running the Nuxt web app portion of the project.

What is included
- Node 20 (via the base image) — used for Nuxt, npm scripts and building the web app.
- Java 21 (via the devcontainer feature) — useful for Gradle native builds where available.

What this does not include
- Full Android SDK / emulator. Installing the Android SDK inside Codespaces is possible but large and often unnecessary for quick web development. For Android native builds use a local machine or an environment prepared for Android development (see repo README).

Post-create step
- The devcontainer runs `npm ci` after creation to install Node dependencies.

Useful tasks
- Use the VS Code tasks (in `.vscode/tasks.json`) to run `npm run dev`, `npm run generate && npx cap sync`, or `npm ci` inside the container.
