#!/usr/bin/env node
// Typecheck the Nuxt/TS sources and compare the result against a committed baseline.
//
// Why a baseline: the Nuxt 2 -> 3 migration left a set of pre-existing type errors that
// nobody is fixing right now. A bare `vue-tsc` run therefore always fails, which means it
// gets ignored, which means a genuinely new type error looks identical to the old noise.
// The baseline records what is already broken so this script can answer the only question
// that matters while the migration is in flight: did this change add a type error?
//
//   node scripts/typecheck.mjs            check against the baseline
//   node scripts/typecheck.mjs --update   re-record the baseline (after fixing errors)
//
// Baseline entries are keyed by file + error code + message, deliberately NOT by line
// number, so unrelated edits above an error do not show up as new failures.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = resolve(ROOT, 'scripts/typecheck-baseline.json')
const UPDATE = process.argv.includes('--update')

function fail(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

// vue-tsc 3.x aborts partway through on this project and still prints "Found 0 errors",
// which reads as a clean pass. Refuse to run on a major we have not verified rather than
// report a result that cannot be trusted.
function assertUsableVueTsc() {
  const require = createRequire(resolve(ROOT, 'package.json'))
  let version
  try {
    version = require('vue-tsc/package.json').version
  } catch {
    fail('vue-tsc is not installed. Run `npm ci` (it is pinned in devDependencies).')
  }

  const major = Number(version.split('.')[0])
  if (major !== 2) {
    fail(
      `vue-tsc ${version} is installed, but only 2.x is known to typecheck this project.\n` +
        '  3.x exits early and still prints "Found 0 errors" — a false pass.\n' +
        '  Do not run `npx vue-tsc`; that resolves the latest release.'
    )
  }
  return version
}

// Always regenerate, never just when .nuxt is missing. Nuxt writes the auto-import declarations
// for composables/, stores/ and constants/ into .nuxt, so a stale copy reports a brand new
// composable as "Cannot find name" — a failure in the checker, not in the code.
function ensureNuxtTypes() {
  console.log('• running nuxi prepare to refresh auto-import types')
  execFileSync('npx', ['nuxi', 'prepare'], { cwd: ROOT, stdio: 'inherit' })
}

// `path(line,col): error TSxxxx: message`
const ERROR_LINE = /^(?<file>[^(]+)\((?<line>\d+),(?<col>\d+)\): error (?<code>TS\d+): (?<message>.*)$/

function runTypecheck() {
  const result = spawnSync(resolve(ROOT, 'node_modules/.bin/vue-tsc'), ['--noEmit', '-p', 'tsconfig.json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })

  if (result.error) fail(`could not run vue-tsc: ${result.error.message}`)

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const counts = new Map()
  let parsed = 0

  for (const raw of output.split('\n')) {
    const match = ERROR_LINE.exec(raw.trim())
    if (!match) continue
    parsed += 1
    const key = `${match.groups.file}|${match.groups.code}|${match.groups.message}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  // A crashed compiler produces no parseable diagnostics and a non-zero exit. That is not
  // a clean run, and treating it as one is exactly the failure mode this script guards.
  if (parsed === 0 && result.status !== 0) {
    console.error(output.slice(-4000))
    fail('vue-tsc exited non-zero without emitting any diagnostics — treat this as a broken run, not a pass.')
  }

  return { counts, total: parsed, output }
}

const version = assertUsableVueTsc()
ensureNuxtTypes()
console.log(`• typechecking with vue-tsc ${version}`)
const { counts, total } = runTypecheck()

if (UPDATE) {
  const entries = Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(
    BASELINE,
    `${JSON.stringify({ recordedAt: new Date().toISOString().slice(0, 10), totalErrors: total, entries }, null, 2)}\n`
  )
  console.log(`✓ baseline updated: ${total} pre-existing error(s) across ${counts.size} distinct site(s)`)
  process.exit(0)
}

if (!existsSync(BASELINE)) {
  fail('no baseline recorded. Run `node scripts/typecheck.mjs --update` on a known-good commit first.')
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
const expected = new Map(Object.entries(baseline.entries ?? {}))

const added = []
for (const [key, count] of counts) {
  const was = expected.get(key) ?? 0
  if (count > was) added.push({ key, was, now: count })
}

const fixed = []
for (const [key, was] of expected) {
  const now = counts.get(key) ?? 0
  if (now < was) fixed.push({ key, was, now })
}

if (fixed.length) {
  console.log(`\n• ${fixed.length} baselined error(s) no longer reported — run --update to tighten the baseline:`)
  for (const { key, was, now } of fixed.slice(0, 10)) {
    const [file, code, message] = key.split('|')
    console.log(`    ${file}  ${code}  ${message}  (${was} → ${now})`)
  }
}

if (added.length) {
  console.error(`\n✗ ${added.length} new type error(s) not in the baseline:\n`)
  for (const { key, was, now } of added) {
    const [file, code, message] = key.split('|')
    console.error(`  ${file}`)
    console.error(`    ${code}: ${message}${was ? `  (baseline allows ${was}, found ${now})` : ''}`)
  }
  console.error('')
  process.exit(1)
}

console.log(`✓ no new type errors (${total} baselined error(s) still present)`)
