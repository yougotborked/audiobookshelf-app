# Queue-related changes before 32744b1

## Harden play queue restoration (743f265)
- Added `resolveQueueItemIds`/`sanitizeQueue` to rebuild stored queue entries using any available server or local IDs, skipping entries without an identifiable `libraryItemId`.
- During store initialization, the queue index now re-aligns with the native playback session by matching local or server IDs before defaulting to index 0.

## Handle local episode library IDs during resolution (431c694)
- Extended `resolveQueueItemIds` to fall back to `localEpisode.localLibraryItemId` so offline queue items still retain a `libraryItemId` when sanitized.

## Normalize unfinished playlist queue items (b3ec23a)
- Introduced `normalizeQueueItem`/`getNormalizedPlayableItems` for auto playlists so each queue entry carries both server and local IDs when available.
- `playAll`/`playNextItem` now build the queue from normalized items and emit play payloads that include local and server IDs, ensuring playback can start even when items are cached locally.

## Improve auto playlist queue normalization (65a1d61)
- Refined normalization to separate raw, server, and local IDs, preventing local IDs from being treated as server IDs.
- When fetching playlists, cached downloads are mapped onto playlist items so normalized queue entries include matching local episodes before playback begins.
