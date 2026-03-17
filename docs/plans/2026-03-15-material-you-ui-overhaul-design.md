# Material You UI Overhaul — Design Document
**Date:** 2026-03-15
**Scope:** Android app only (Capacitor WebView, NuxtJS 2 + Tailwind CSS + Vue)
**Theme:** Dark (primary user preference)
**Motion:** Subtle — all animations respect `prefers-reduced-motion`
**Strategy:** Global design-token pass first, then screen deep-dives

---

## Goals

1. Modernise the app to a Material Design 3 (M3) inspired aesthetic adapted for Tailwind/Vue
2. Establish a visual testing pipeline (Playwright + json-server) so every change can be seen before/after
3. Replace flat, uniform surfaces with an elevation-based surface hierarchy
4. Improve typography scale and visual hierarchy throughout
5. Use `fast-average-color` (already installed) for dynamic Now Playing colour derived from cover art
6. Make every reusable UI component polished and consistent

## Non-Goals

- iOS-specific UI (Android only)
- New features or behaviour changes
- Light theme work (Dark theme first)
- Migrating from NuxtJS 2 (too risky)
- Replacing the icon font (keep Material Symbols + absicons)

---

## Architecture

### Colour System — M3 Tonal Roles (Dark theme)

Replace the current flat grey palette with M3 role-based tokens in `tailwind.css`:

```
Surface levels (elevation via tint, not shadow):
  --md-surface-0: #121212        (base background)
  --md-surface-1: #1e1e1e        (+5% primary tint overlay)
  --md-surface-2: #222222        (+8%)
  --md-surface-3: #272727        (+11%)
  --md-surface-4: #282828        (+12%)
  --md-surface-5: #2c2c2c        (+14%)

Colour roles:
  --md-primary:           #1ad691   (existing accent, keep)
  --md-on-primary:        #003828
  --md-primary-container: #00513d
  --md-on-primary-container: #6ef5c3
  --md-secondary:         #b2ccc0
  --md-on-secondary:      #1d352c
  --md-error:             #ffb4ab
  --md-on-error:          #690005
  --md-outline:           #8e9994
  --md-outline-variant:   #3f4945

Text roles:
  --md-on-surface:        #e2e8e5   (primary text)
  --md-on-surface-variant:#b2ccc0   (secondary text)
```

Dynamic colour (Now Playing only): derived at runtime from cover art using
`fast-average-color`, applied as `--dynamic-primary` and `--dynamic-surface`
CSS custom properties on the player container element.

### Typography — M3 Type Scale

Replace Source Sans Pro scale with a proper M3 hierarchy (keeping Source Sans Pro
as the typeface — it's already loaded):

```
Display Large:   57px / 64 line / -0.25 tracking / 400 weight
Display Medium:  45px / 52 line / 0 tracking    / 400 weight
Display Small:   36px / 44 line / 0 tracking    / 400 weight

Headline Large:  32px / 40 line / 0 tracking    / 400 weight
Headline Medium: 28px / 36 line / 0 tracking    / 400 weight
Headline Small:  24px / 32 line / 0 tracking    / 400 weight

Title Large:     22px / 28 line / 0 tracking    / 400 weight
Title Medium:    16px / 24 line / +0.15 tracking / 500 weight
Title Small:     14px / 20 line / +0.1 tracking  / 500 weight

Body Large:      16px / 24 line / +0.5 tracking  / 400 weight
Body Medium:     14px / 20 line / +0.25 tracking / 400 weight
Body Small:      12px / 16 line / +0.4 tracking  / 400 weight

Label Large:     14px / 20 line / +0.1 tracking  / 500 weight
Label Medium:    12px / 16 line / +0.5 tracking  / 500 weight
Label Small:     11px / 16 line / +0.5 tracking  / 500 weight
```

Expose as Tailwind utilities: `text-md-display-l`, `text-md-headline-m`, etc.

### Shape System

```
--md-shape-none:    0px
--md-shape-xs:      4px
--md-shape-sm:      8px
--md-shape-md:      12px
--md-shape-lg:      16px
--md-shape-xl:      28px
--md-shape-full:    9999px
```

### Motion System

```
--md-motion-standard:    200ms cubic-bezier(0.2, 0, 0, 1)
--md-motion-emphasized:  300ms cubic-bezier(0.2, 0, 0, 1)
--md-motion-decelerate:  250ms cubic-bezier(0, 0, 0, 1)
--md-motion-accelerate:  200ms cubic-bezier(0.3, 0, 1, 1)
```

All transitions wrapped in `@media (prefers-reduced-motion: no-preference)`.

### Elevation Model

M3 dark theme uses colour tinting for elevation (not shadow depth).
Higher surfaces appear lighter via a white overlay at increasing opacity:
- Level 0: no tint
- Level 1 (+5%): cards at rest
- Level 2 (+8%): floating action buttons, chips
- Level 3 (+11%): modals, drawers
- Level 4 (+12%): navigation bars, app bar
- Level 5 (+14%): tooltips

---

## Implementation Phases

### Phase 0 — Visual Testing Pipeline

**Goal:** See the app before touching it; validate every phase visually.

Tasks:
- P0.1: Install Playwright + json-server in distrobox
- P0.2: Create `mock/db.json` with representative library data (10 books, 3 podcasts, 1 series)
- P0.3: Write `scripts/screenshot.js` — Playwright script that:
  - Starts json-server on :3001 proxying as ABS API
  - Starts `nuxt dev` on :1337 with mock server config
  - Navigates to every key page and takes a screenshot
  - Saves to `docs/screenshots/YYYY-MM-DD-HH-MM/`
- P0.4: Take baseline screenshots of current state
- Verification: screenshots saved and readable via `Read` tool

### Phase 1 — Design Token System

**Goal:** Replace flat-grey variables with M3-inspired role tokens. Zero visual regressions
on non-updated components — just a token rename/restructure.

Tasks:
- P1.1: Rewrite `assets/tailwind.css` — add M3 surface levels, colour roles, text roles,
  shape vars, motion vars while keeping backward-compat aliases for existing `--color-*` vars
  (so no components break until Phase 2 updates them)
- P1.2: Extend `tailwind.config.js` — add M3 type scale utilities, surface colour shortcuts,
  shape radius utilities
- P1.3: Update `assets/app.css` — rework box-shadow utilities to use elevation tinting
  instead of dark drop-shadows; update `.bookshelfRow` wood texture to a subtle surface-1
  pattern (remove the skeuomorphic wood)
- P1.4: Screenshot after token update — confirm no regressions
- Verification: `npm run build` succeeds; no new console errors

### Phase 2 — Global Component Library

**Goal:** Every reusable component speaks M3. Highest-impact, widest blast radius.

Components (in order of visual impact):

**P2.1 — ui/Btn.vue** — M3 button variants:
- `filled` (primary background, on-primary text) — default
- `filled-tonal` (primary-container bg, on-primary-container text)
- `outlined` (transparent + outline border)
- `text` (transparent, primary text)
- `elevated` (surface-1 + shadow)
- Press state: ripple-effect via CSS (scale 0.97 + opacity flash)
- Remove current pseudo-element hover hack

**P2.2 — ui/TextInput.vue + TextInputWithLabel.vue** — M3 text field:
- `outlined` variant (border rounds on focus with label float animation)
- Active indicator line on bottom
- Label floats on focus/fill

**P2.3 — ui/ToggleSwitch.vue** — M3 Switch:
- Track: wide rounded rect (52×32px), primary colour when on
- Thumb: circle with subtle shadow, larger when pressed (icon inside when state changes)

**P2.4 — cards/LazyBookCard.vue** — M3 Card:
- Surface-1 background (not transparent/flat)
- Shape-md border radius (12px)
- Pressed state: surface-2 background transition
- Progress bar: primary colour with rounded ends
- Remove current book-shadow skeuomorphism; replace with elevation-1 tint

**P2.5 — modals/Modal.vue** — M3 Bottom Sheet:
- Slide up from bottom (not just fade)
- Drag handle at top
- Surface-3 background (elevated)
- Shape-xl top corners (28px radius)
- Scrim: 32% black overlay
- Spring-physics-inspired slide (decelerate easing out, accelerate easing in)

**P2.6 — widgets/LoadingSpinner.vue + SpinnerIcon.vue** — M3 Circular Progress:
- Indeterminate: rotating arc with growing/shrinking tail
- Determinate: static arc

**P2.7 — components/widgets/ConnectionIndicator.vue** — M3 Badge style:
- Pill with icon + label, surface-2 background

**P2.8 — home/BookshelfNavBar.vue** — M3 Navigation Bar:
- Surface-4 background (elevated from content)
- Active indicator: primary-container pill behind icon
- Label text only for active tab

**P2.9 — app/Appbar.vue** — M3 Top App Bar:
- Surface-4 background
- Scrolled state: surface-5 with shadow
- Title: Title-Large type role

### Phase 3 — Screen Deep Dives

**Goal:** Apply Phase 1+2 tokens to full page layouts. One screen per task.

**P3.1 — pages/connect.vue** — M3 Sign-In:
- Centered card layout with surface-2 card
- App icon with tinted container background
- Server URL: M3 outlined text field
- Connect button: M3 filled button full-width
- Error state: error-colour banner

**P3.2 — pages/bookshelf/index.vue** — Library Grid:
- Surface-0 background
- Book grid: tighter gap (8px), cards at surface-1
- Section headers: Label-Large type role, on-surface-variant colour
- Empty state: illustrated placeholder (SVG inline) + Headline-Small + Body-Medium

**P3.3 — components/app/AudioPlayer.vue (minimised + expanded)** — Now Playing:
- **Dynamic colour**: on player open, run `fast-average-color` on current cover art,
  derive a tinted surface colour, animate background colour transition (300ms)
- Minimised bar: surface-4 bg, cover thumbnail with shape-sm, title + artist marquee
- Expanded player:
  - Full-height sheet (slide up from bar)
  - Cover art: large, shape-lg, subtle drop-shadow
  - Dynamic colour bleeds into background as a radial gradient
  - Controls: M3 icon buttons with filled-tonal play/pause
  - Seek bar: M3 slider (primary colour, thumb with elevation)
  - Sleep timer / chapters / queue: bottom row of icon+label buttons

**P3.4 — pages/item/_id/index.vue** — Item Detail:
- M3 Large Collapsing App Bar (cover art behind bar, shrinks on scroll)
- Play button: M3 FAB (large, primary-container colour)
- Metadata: Body-Medium, on-surface-variant
- Chapters/tracks table: List tiles with dividers

**P3.5 — pages/settings.vue** — Settings:
- M3 settings list with grouped categories (surface-1 cards per group)
- Section headers: Label-Large, primary colour
- List tiles: Title-Medium + Body-Small supporting text
- Toggles, selects use Phase 2 components

---

## Error Handling

- All dynamic-colour operations are wrapped in try/catch; fallback to `--md-surface-3` if
  `fast-average-color` throws
- Token renaming is additive (old vars kept as aliases) — no component breaks during phase transition

## Testing Strategy

- Playwright screenshots after each phase (diff against baseline)
- Manual device test on Android after Phase 2 and Phase 3
- `npm run build` must pass after every task
- `npm run lint` must pass after every task

## Rollout Notes

- All changes are on `master` branch (personal fork, no upstream PR)
- Phase 0 scripts live in `scripts/` — not shipped in the APK (not part of `dist/`)
- Mock data lives in `mock/` — gitignored
- APK build after each phase to verify no WebView rendering regressions

---

## File Change Map

| Phase | Files Changed |
|-------|--------------|
| P0    | scripts/screenshot.js, mock/db.json, package.json (devDeps) |
| P1    | assets/tailwind.css, tailwind.config.js, assets/app.css |
| P2    | components/ui/Btn.vue, TextInput.vue, TextInputWithLabel.vue, ToggleSwitch.vue, cards/LazyBookCard.vue, modals/Modal.vue, widgets/LoadingSpinner.vue, widgets/SpinnerIcon.vue, widgets/ConnectionIndicator.vue, home/BookshelfNavBar.vue, app/Appbar.vue |
| P3    | pages/connect.vue, pages/bookshelf/index.vue, components/app/AudioPlayer.vue, pages/item/_id/index.vue, pages/settings.vue |
