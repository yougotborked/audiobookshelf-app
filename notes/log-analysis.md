# Log Analysis – 2025-11-23 Playback & Sync

## Observations
- Playback queue creation and normalization succeed: 81 playlist items normalized, queued, and emitted for playback without truncation or errors.
- Sync attempts to send local media progress run repeatedly (roughly every 6 seconds) and discover 7 local progress entries each time.
- Each sync attempt fails with `Failed to load user from server (https://[SERVER_ADDRESS] (abork))`, so no progress updates reach the server.

## Impact
- User’s playback progress remains only on the device; server-side progress and any multi-device continuity will be out of date.
- Repeated failed syncs generate unnecessary network traffic and log noise.

## Mitigation Suggestions
1. **Validate server connectivity and authentication**
   - Confirm the base URL `[SERVER_ADDRESS]` is reachable (DNS, TLS, firewall) and the user’s session/token is valid.
   - Add a pre-flight user lookup before queuing syncs to fail fast with clearer context when authentication is invalid.

2. **Backoff on repeated sync failures**
   - Introduce exponential backoff or a capped retry interval after authentication/connection failures instead of retrying every ~6 seconds.
   - Surface a user-visible warning after consecutive failures so the user knows progress is not being uploaded.

3. **Log actionable error detail**
   - Include the HTTP status/exception message in `syncLocalMediaProgressForUser` failures to help distinguish auth vs. connectivity issues.

4. **Persist unsent progress with limits**
   - Ensure the 7 queued progress entries are durable across app restarts and consider bounding the queue size to prevent growth if the server remains unreachable.

## Quick Checklist for Troubleshooting
- Server URL resolves and is reachable from the device.
- TLS certificate is valid and trusted by the device.
- User session/token is not expired or invalidated.
- Connectivity type (Wi-Fi/Cellular) allows outbound requests to the server.
