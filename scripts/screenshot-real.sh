#!/usr/bin/env bash
# Usage: ./scripts/screenshot-real.sh <server-url> <api-token>
export ABS_SERVER_URL="$1"
export ABS_API_TOKEN="$2"
node node_modules/.bin/playwright test scripts/screenshot.js --config playwright.config.js
