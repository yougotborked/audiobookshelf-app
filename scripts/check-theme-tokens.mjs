#!/usr/bin/env node
// Fails when a component reaches for a colour outside the Material token set.
//
// Two things this catches, for different reasons:
//
//   - The retired alias tokens (text-fg, bg-primary, border-border …). These used to be defined
//     as exact duplicates of Material tokens, which is how two vocabularies for one palette grew
//     side by side. The definitions are gone now, so a stray one renders *no colour at all* -
//     a silent failure that a screenshot of the wrong theme might not even show.
//   - Raw Tailwind palette colours (text-gray-400, bg-slate-200 …). These are fixed values that
//     do not change between themes, so they look deliberate in dark and wrong in light. That is
//     exactly how the light theme ended up with unreadable secondary text.
//
//   node scripts/check-theme-tokens.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCAN = ['pages', 'components', 'layouts', 'assets']

// Retired in favour of their Material equivalents; see assets/tailwind.css.
const RETIRED = ['fg-muted', 'fg', 'bg-hover', 'bg-toggle-selected', 'bg-toggle', 'bg', 'border', 'primary', 'secondary', 'accent', 'dynamic-primary', 'dynamic-surface']
const PREFIX = 'text|bg|border|ring|from|to|via|divide|placeholder|fill|stroke|outline|shadow|caret'
const retiredRe = new RegExp(`\\b(${PREFIX})-(${RETIRED.join('|')})\\b`, 'g')
const paletteRe = /\b(text|bg|border|ring|from|to|via|divide|fill|stroke)-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g

// Deliberate exceptions, each with a reason.
const ALLOW = new Map([
  // Chosen against the cover art's own lightness, not against the theme - the pairing is the
  // point, and no token can express "whatever contrasts with this artwork".
  ['components/app/AudioPlayer.vue', [/text-gray-800/]]
])

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* walk(path)
    else if (/\.(vue|css)$/.test(path)) yield path
  }
}

const problems = []
for (const base of SCAN) {
  for (const path of walk(join(ROOT, base))) {
    const rel = relative(ROOT, path)
    // tailwind.css defines the tokens; it is allowed to name them
    if (rel === 'assets/tailwind.css') continue
    const allowed = ALLOW.get(rel) || []
    const source = readFileSync(path, 'utf8')
    source.split('\n').forEach((line, i) => {
      for (const re of [retiredRe, paletteRe]) {
        re.lastIndex = 0
        for (const match of line.matchAll(re)) {
          if (allowed.some((a) => a.test(match[0]))) continue
          problems.push({ rel, line: i + 1, token: match[0] })
        }
      }
    })
  }
}

if (!problems.length) {
  console.log('✓ no retired or off-palette colour classes')
  process.exit(0)
}

console.error(`✗ ${problems.length} off-palette colour class(es):\n`)
for (const p of problems) console.error(`  ${p.rel}:${p.line}  ${p.token}`)
console.error('\nUse the Material tokens in assets/tailwind.css (md-surface-*, md-on-surface*, md-outline*, md-primary*).')
process.exit(1)
