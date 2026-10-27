// Measures how many of your podcasts publish transcripts.
//
// Roadmap item 5 (cross-podcast story summarisation) rests on one number. Pulling together what
// several shows said about the same story needs two things that only a transcript gives:
// knowing what was said, and knowing *when* in the episode it was said. Without timings there is
// nothing to cut, so the segment cannot be played - only described.
//
// The podcast namespace defines <podcast:transcript> on each <item>. Some feeds carry it, most do
// not, and generating transcripts locally costs real compute on somebody's home server. So before
// any of that is designed, this counts what is actually there across your own subscriptions.
//
//   PODSHELF_SERVER=https://abs.example.com PODSHELF_TOKEN=... node scripts/check-transcripts.mjs
//   node scripts/check-transcripts.mjs --feeds feeds.txt     one RSS url per line, no server
//   node scripts/check-transcripts.mjs --json                machine-readable
//
// The token is an Audiobookshelf API token: Settings -> Users -> your user, or the one the app
// already holds. Nothing is written anywhere; this only reads.

import fs from 'node:fs'
import process from 'node:process'

/** Formats that carry timings, and so can be cut into playable segments. */
const TIMED_FORMATS = new Set(['text/vtt', 'application/x-subrip', 'application/srt', 'application/json'])

/** Attributes of one tag, as a plain object. Values may be single- or double-quoted. */
export function parseAttributes(tag) {
  const attrs = {}
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    attrs[match[1].toLowerCase()] = match[3] !== undefined ? match[3] : match[4]
  }
  return attrs
}

/**
 * The transcripts declared on one `<item>`.
 *
 * `type` is required by the namespace spec, but feeds in the wild omit it, so a missing type is
 * recorded as unknown rather than dropped - it still means the publisher intended a transcript.
 */
export function parseTranscripts(itemXml) {
  const transcripts = []
  for (const match of itemXml.matchAll(/<podcast:transcript\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0])
    if (!attrs.url) continue
    transcripts.push({
      url: attrs.url,
      type: (attrs.type || 'unknown').toLowerCase(),
      language: attrs.language || null,
      // rel="captions" marks a transcript meant as captions for the whole episode
      isCaptions: (attrs.rel || '').toLowerCase() === 'captions'
    })
  }
  return transcripts
}

/** Whether a transcript can be cut into playable segments, or only read. */
export function isTimedFormat(type) {
  return TIMED_FORMATS.has(String(type || '').toLowerCase())
}

/** Every `<item>` in a feed. Done by hand to keep this dependency-free. */
export function splitItems(xml) {
  return [...String(xml || '').matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map((m) => m[0])
}

/** What one feed contributes: episode counts and the formats it publishes. */
export function analyseFeed(xml) {
  const items = splitItems(xml)
  const formats = {}
  let withTranscript = 0
  let withTimed = 0

  for (const item of items) {
    const transcripts = parseTranscripts(item)
    if (!transcripts.length) continue
    withTranscript++
    if (transcripts.some((t) => isTimedFormat(t.type))) withTimed++
    for (const t of transcripts) formats[t.type] = (formats[t.type] || 0) + 1
  }

  return { episodes: items.length, withTranscript, withTimed, formats }
}

/** Adds up per-feed results into the one number the roadmap asked for. */
export function summarise(results) {
  const ok = results.filter((r) => !r.error)
  const summary = {
    feeds: results.length,
    feedsFailed: results.length - ok.length,
    feedsWithAny: ok.filter((r) => r.withTranscript > 0).length,
    feedsWithTimed: ok.filter((r) => r.withTimed > 0).length,
    // A show that transcribes everything is worth more than one that did it twice, because a
    // story can only be followed across shows that cover it consistently
    feedsMostlyCovered: ok.filter((r) => r.episodes > 0 && r.withTranscript / r.episodes >= 0.9).length,
    episodes: ok.reduce((n, r) => n + r.episodes, 0),
    episodesWithTranscript: ok.reduce((n, r) => n + r.withTranscript, 0),
    episodesWithTimed: ok.reduce((n, r) => n + r.withTimed, 0),
    formats: {}
  }
  for (const r of ok) {
    for (const [type, count] of Object.entries(r.formats)) {
      summary.formats[type] = (summary.formats[type] || 0) + count
    }
  }
  return summary
}

export function percent(part, whole) {
  if (!whole) return 0
  return Math.round((part / whole) * 1000) / 10
}

/**
 * The call the number supports.
 *
 * Deliberately blunt. The point of measuring first was to avoid designing something that the
 * available data cannot support, so a thin result should say so rather than be written up kindly.
 */
export function verdict(summary) {
  const timedShows = summary.feedsWithTimed
  const timedEpisodes = percent(summary.episodesWithTimed, summary.episodes)

  if (timedShows === 0) {
    return 'No feed publishes a timed transcript. Cross-podcast summarisation would have to generate its own, which is the expensive path the roadmap wanted to avoid. Do not build this on feed transcripts.'
  }
  if (timedShows < 3) {
    return `Only ${timedShows} show(s) publish timed transcripts. A story has to be covered by several shows at once for this to mean anything, so that is too thin a base. Not feasible from feed data alone.`
  }
  if (timedEpisodes < 20) {
    return `${timedShows} shows publish timed transcripts, but only ${timedEpisodes}% of episodes overall. Enough to prototype segmentation against, not enough to rely on. Worth a narrow trial limited to those shows.`
  }
  return `${timedShows} shows and ${timedEpisodes}% of episodes carry timed transcripts. There is a real base here: worth designing against feed transcripts, with generation only as a fallback.`
}

export function formatReport(summary, results) {
  const lines = []
  const pct = (a, b) => `${percent(a, b)}%`

  lines.push('')
  lines.push('Transcript coverage across your subscriptions')
  lines.push('─'.repeat(60))
  lines.push(`Feeds read                ${summary.feeds - summary.feedsFailed}/${summary.feeds}`)
  lines.push(`Shows with any transcript ${summary.feedsWithAny} (${pct(summary.feedsWithAny, summary.feeds - summary.feedsFailed)})`)
  lines.push(`  ...with timings         ${summary.feedsWithTimed}`)
  lines.push(`  ...covering ~every ep   ${summary.feedsMostlyCovered}`)
  lines.push(`Episodes seen             ${summary.episodes}`)
  lines.push(`  ...with any transcript  ${summary.episodesWithTranscript} (${pct(summary.episodesWithTranscript, summary.episodes)})`)
  lines.push(`  ...with timings         ${summary.episodesWithTimed} (${pct(summary.episodesWithTimed, summary.episodes)})`)

  const formats = Object.entries(summary.formats).sort((a, b) => b[1] - a[1])
  if (formats.length) {
    lines.push('')
    lines.push('Formats published')
    for (const [type, count] of formats) {
      lines.push(`  ${isTimedFormat(type) ? '✓' : ' '} ${type.padEnd(24)} ${count}`)
    }
    lines.push('  ✓ = carries timings, so a segment can be cut and played')
  }

  const withAny = results.filter((r) => !r.error && r.withTranscript > 0).sort((a, b) => b.withTimed - a.withTimed)
  if (withAny.length) {
    lines.push('')
    lines.push('Shows that publish transcripts')
    for (const r of withAny) {
      lines.push(`  ${r.title.slice(0, 38).padEnd(40)} ${r.withTranscript}/${r.episodes} (${r.withTimed} timed)`)
    }
  }

  const failed = results.filter((r) => r.error)
  if (failed.length) {
    lines.push('')
    lines.push('Feeds that could not be read')
    for (const r of failed) lines.push(`  ${r.title.slice(0, 38).padEnd(40)} ${r.error}`)
  }

  lines.push('')
  lines.push('Verdict')
  lines.push(`  ${verdict(summary)}`)
  lines.push('')
  return lines.join('\n')
}

// ── I/O below this line ───────────────────────────────────────────────────────

async function fetchText(url, timeoutMs = 20000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // Some podcast hosts serve a different body, or none, to an unrecognised client
      headers: { 'user-agent': 'Podshelf-TranscriptProbe/1.0 (+https://github.com/yougotborked/podshelf-app)' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

/** Podcast library items from an Audiobookshelf server, as {title, feedUrl}. */
async function feedsFromServer(server, token) {
  const base = server.replace(/\/$/, '')
  const headers = { authorization: `Bearer ${token}` }

  const librariesRes = await fetch(`${base}/api/libraries`, { headers })
  if (!librariesRes.ok) throw new Error(`Listing libraries failed: HTTP ${librariesRes.status}`)
  const libraries = (await librariesRes.json()).libraries || []
  const podcastLibraries = libraries.filter((l) => l.mediaType === 'podcast')
  if (!podcastLibraries.length) throw new Error('No podcast libraries on this server')

  const feeds = []
  for (const library of podcastLibraries) {
    const res = await fetch(`${base}/api/libraries/${library.id}/items?limit=0`, { headers })
    if (!res.ok) throw new Error(`Listing ${library.name} failed: HTTP ${res.status}`)
    for (const item of (await res.json()).results || []) {
      const metadata = item.media?.metadata || {}
      if (metadata.feedUrl) feeds.push({ title: metadata.title || item.id, feedUrl: metadata.feedUrl })
    }
  }
  return feeds
}

function feedsFromFile(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((feedUrl) => ({ title: feedUrl.replace(/^https?:\/\//, '').slice(0, 38), feedUrl }))
}

/** Reads feeds a few at a time: polite to the hosts, and fast enough for a few hundred. */
async function analyseAll(feeds, concurrency = 6) {
  const results = []
  let next = 0
  async function worker() {
    while (next < feeds.length) {
      const feed = feeds[next++]
      try {
        const xml = await fetchText(feed.feedUrl)
        results.push({ ...feed, ...analyseFeed(xml) })
      } catch (error) {
        results.push({ ...feed, episodes: 0, withTranscript: 0, withTimed: 0, formats: {}, error: error.message })
      }
      process.stderr.write(`\r  read ${results.length}/${feeds.length} feeds`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, feeds.length) }, worker))
  process.stderr.write('\r' + ' '.repeat(40) + '\r')
  return results
}

async function main() {
  const args = process.argv.slice(2)
  const asJson = args.includes('--json')
  const feedsFileIndex = args.indexOf('--feeds')

  let feeds
  if (feedsFileIndex !== -1) {
    feeds = feedsFromFile(args[feedsFileIndex + 1])
  } else {
    const server = process.env.PODSHELF_SERVER
    const token = process.env.PODSHELF_TOKEN
    if (!server || !token) {
      console.error('Set PODSHELF_SERVER and PODSHELF_TOKEN, or pass --feeds <file> with one RSS url per line.')
      process.exit(2)
    }
    feeds = await feedsFromServer(server, token)
  }

  if (!feeds.length) {
    console.error('No podcast feeds found.')
    process.exit(2)
  }

  const results = await analyseAll(feeds)
  const summary = summarise(results)

  if (asJson) {
    console.log(JSON.stringify({ summary, verdict: verdict(summary), feeds: results }, null, 2))
  } else {
    console.log(formatReport(summary, results))
  }
}

// Only run when invoked directly, so the pure functions above can be imported by tests.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(`\n${error.message}`)
    process.exit(1)
  })
}
