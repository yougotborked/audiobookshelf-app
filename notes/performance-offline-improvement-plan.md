# Performance and Offline Reliability Improvement Plan

## Context and Problem Statement

The mobile app has two related pain points:

1. **App performance degrades** in critical flows (home shelves, playback startup/resume, and library navigation), especially when data volume is large.
2. **Offline and local playback behavior is fragile**, with sync-state mismatches and weak fallback behavior when connectivity changes.

This plan focuses on architectural improvements that improve responsiveness, make playback state resilient, and guarantee deterministic online/offline fallbacks.

## Goals

- Reduce time-to-interactive and list rendering latency in large libraries.
- Improve playback startup/resume reliability for local downloads.
- Ensure offline actions are queued and synchronized safely when connectivity returns.
- Provide clear user feedback for stale/out-of-sync offline state.
- Define measurable acceptance criteria with instrumentation.

## Non-Goals

- Replacing the entire data layer in one release.
- Building a full conflict-free replicated database.
- Reworking server APIs beyond the minimum needed for robust sync.

## Current-Risk Areas (Hypothesis)

- Network-first fetching blocks rendering instead of showing cached snapshots.
- Download metadata and playback positions are updated in multiple places with inconsistent rules.
- Connectivity changes are treated as binary online/offline without transitional handling (flapping, captive network, auth expiration).
- Large lists and now-playing updates trigger excessive re-renders.

## Architecture Direction

### 1) Single Source of Truth for Media State

Introduce a unified local state model for:

- media entities (book/podcast/episode metadata)
- download status and local file location
- playback state (position, speed, chapter, last-updated timestamp)
- sync status (pending, synced, failed, conflict)

Use one repository/service layer to read and write this model and expose typed operations to UI and playback subsystems.

### 2) Offline-First Read Path

Adopt a **stale-while-revalidate** strategy for shelves/library/detail screens:

- read cached snapshot immediately
- render with explicit freshness indicator
- revalidate in background when network is available
- merge updates incrementally to avoid jank

### 3) Durable Mutation Queue

All user mutations while offline (progress updates, bookmark changes, library actions) should enter a persistent queue with:

- idempotency key
- operation type + payload version
- retry/backoff policy
- conflict resolution strategy

Queue flush runs when network is restored or app resumes.

### 4) Deterministic Playback Fallback Rules

When playback starts:

1. Prefer verified local file if available and checksum/path is valid.
2. If local unavailable but network healthy, stream remotely.
3. If neither available, show actionable recovery state (re-link file, redownload, retry).

When connectivity drops during streaming:

- attempt handoff to local file for same item if present
- preserve position atomically before transition

### 5) Performance Guardrails

- Virtualize long shelves and table/list views where practical.
- Batch/debounce high-frequency updates (progress/timers).
- Split heavy components and avoid expensive watchers/computed chains in hot paths.
- Move CPU-heavy transforms off critical render path.

## Implementation Phases

### Phase 0: Baseline and Instrumentation (1 sprint)

- Add performance markers (screen render duration, playback start latency, sync queue depth, flush success rate).
- Add offline telemetry (queue retries, conflict counts, fallback occurrences).
- Document current behavior in reproducible scenarios.

**Exit criteria**
- Baseline dashboard exists for core metrics.
- Top 5 high-latency screens identified.

### Phase 1: Data Layer Consolidation (1-2 sprints)

- Introduce repository interface and centralize write paths for downloads/playback progress.
- Migrate existing call sites incrementally behind feature flags.
- Add contract tests for repository behavior.

**Exit criteria**
- All playback progress writes use one service.
- No duplicate mutation paths for download state.

### Phase 2: Offline Queue + Sync Engine (2 sprints)

- Implement persistent mutation queue and flush worker.
- Add idempotent sync protocol and basic conflict policy (latest-write-wins with safe guards).
- Provide per-item sync diagnostics in developer logs.

**Exit criteria**
- Offline mutations survive app restarts.
- Queue drains successfully after reconnection in test matrix.

### Phase 3: Playback Resilience and Fallback (1 sprint)

- Add explicit playback source resolver (local vs stream) with deterministic rules.
- Add seamless failover handling and persistent position checkpointing.
- Improve user-facing error states and recovery actions.

**Exit criteria**
- Local playback starts within target latency percentile.
- Fallback paths pass airplane-mode transition tests.

### Phase 4: UI/Rendering Optimization (1-2 sprints)

- Optimize hot components, reduce over-rendering, and virtualize long collections.
- Defer non-critical work after initial paint.
- Validate improvements via before/after traces.

**Exit criteria**
- Meet target render and interaction budgets on mid-tier devices.

## Proposed KPIs

- P95 home screen interactive time
- P95 library list first render time
- P95 playback start latency (local and streaming)
- Offline mutation success rate after reconnection
- Sync conflict rate per 1k sessions
- Playback interruption recovery success rate

## Test Matrix

- Fresh install, first sync, then offline use.
- Existing heavy library (10k+ items), repeated shelf navigation.
- Network flapping (Wi-Fi to LTE to offline) during playback.
- App kill/restart with pending offline queue.
- Token expiration while offline and post-reconnect sync recovery.

## Immediate Next Steps

1. Finalize metric definitions and add instrumentation hooks.
2. Build repository abstraction and route playback progress through it.
3. Implement v1 persistent offline mutation queue.
4. Add playback source resolver with local-first fallback logic.
5. Validate against the test matrix and iterate.
