#!/usr/bin/env node
// Verify every strings/*.json file has alphabetized keys — the same thing the
// "Verify all i18n files are alphabetized" workflow checks, runnable before pushing.
//
//   node scripts/check-i18n-sorted.mjs          report unsorted files
//   node scripts/check-i18n-sorted.mjs --fix    rewrite them sorted
//
// The CI action sorts with a plain lexicographic comparison on the raw key, so this does
// too; localeCompare would disagree on case and produce a file CI then rejects.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STRINGS_DIR = join(ROOT, 'strings')
const FIX = process.argv.includes('--fix')

const files = readdirSync(STRINGS_DIR).filter((name) => name.endsWith('.json')).sort()
const problems = []

for (const name of files) {
  const path = join(STRINGS_DIR, name)
  let parsed
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    problems.push({ name, reason: `invalid JSON: ${error.message}` })
    continue
  }

  const keys = Object.keys(parsed)
  const sorted = [...keys].sort()
  const firstDivergence = keys.findIndex((key, index) => key !== sorted[index])

  if (firstDivergence === -1) continue

  if (FIX) {
    const rebuilt = Object.fromEntries(sorted.map((key) => [key, parsed[key]]))
    writeFileSync(path, `${JSON.stringify(rebuilt, null, 2)}\n`)
    console.log(`• sorted ${name}`)
    continue
  }

  problems.push({
    name,
    reason: `key "${keys[firstDivergence]}" should come after "${sorted[firstDivergence]}" (position ${firstDivergence + 1})`
  })
}

if (FIX) {
  console.log('✓ strings/ sorted')
  process.exit(0)
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} i18n file(s) are not alphabetized:\n`)
  for (const { name, reason } of problems) console.error(`  strings/${name}: ${reason}`)
  console.error('\nRun `npm run check:i18n -- --fix` to sort them.\n')
  process.exit(1)
}

console.log(`✓ ${files.length} i18n file(s) alphabetized`)
