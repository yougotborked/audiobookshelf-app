/**
 * Reading a podcast's own RSS feed, and recognising one you already have.
 *
 * Both were server-side before and should not have been. The preview asked Audiobookshelf to
 * fetch the feed for us through `POST /api/podcasts/feed`, which that server restricts to
 * admins — so for everyone else, every podcast in Discover reported "couldn't load this
 * podcast's details from its feed", with no hint that the obstacle was a permission rather than
 * a broken feed. An RSS feed is public; reading one to show a description needs nobody's
 * permission.
 *
 * Everything here is pure string work, so the parsing can be exercised against the shapes real
 * feeds actually emit rather than only against a live server.
 */

/**
 * A feed URL reduced to what identifies the podcast.
 *
 * Directories and servers disagree about feed URLs in ways that mean nothing: Apple hands back
 * `https://` where a library stored `http://`, one carries `www.`, one has a trailing slash, one
 * has tracking parameters bolted on by the hosting platform. Comparing the raw strings made
 * Discover claim a podcast was missing while it sat in the library — which is how Pod Save
 * America showed up as new.
 */
export function normalizeFeedUrl(feedUrl?: string | null): string {
  if (!feedUrl) return ''
  let value = String(feedUrl).trim()
  if (!value) return ''

  // Scheme and case carry no meaning for identity. Done by hand rather than with URL(), which
  // throws on the malformed entries directories genuinely return.
  value = value.replace(/^https?:\/\//i, '')
  value = value.replace(/^www\./i, '')

  // Query strings on a feed URL are analytics, not identity. A feed that genuinely needs a
  // parameter to resolve still matches itself, because both sides get stripped the same way.
  const queryAt = value.search(/[?#]/)
  if (queryAt >= 0) value = value.slice(0, queryAt)

  value = value.replace(/\/+$/, '')
  return value.toLowerCase()
}

/** Whether two feed URLs point at the same podcast, ignoring the differences that never matter. */
export function isSameFeed(a?: string | null, b?: string | null): boolean {
  const left = normalizeFeedUrl(a)
  return left.length > 0 && left === normalizeFeedUrl(b)
}

/** Builds the lookup Discover compares against, keyed by normalized URL. */
export function indexLibraryByFeed<T>(items: T[], feedUrlOf: (item: T) => string | undefined, idOf: (item: T) => string | undefined): Map<string, string> {
  const index = new Map<string, string>()
  for (const item of items) {
    const key = normalizeFeedUrl(feedUrlOf(item))
    const id = idOf(item)
    if (key && id && !index.has(key)) index.set(key, id)
  }
  return index
}

export interface ParsedFeedEpisode {
  title: string
  pubDate: string
  description: string
}

export interface ParsedFeed {
  description: string
  episodes: ParsedFeedEpisode[]
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    // Ampersand last, or an &amp;lt; sequence decodes twice and invents a tag.
    .replace(/&amp;/g, '&')
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * The text of the first matching tag, CDATA unwrapped and markup removed.
 *
 * Feeds put descriptions in `<description>`, `<itunes:summary>` or `<content:encoded>`, wrapped
 * in CDATA or escaped, with HTML inside either way. The screen wants a paragraph to read.
 */
function tagText(source: string, tags: string[]): string {
  for (const tag of tags) {
    const match = source.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'))
    if (!match) continue
    let inner = match[1] ?? ''
    const cdata = inner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
    if (cdata) inner = cdata[1] ?? ''
    const text = stripTags(decodeEntities(inner))
    if (text) return text
  }
  return ''
}

/**
 * Pulls a description and a few recent episodes out of raw RSS.
 *
 * Deliberately regex rather than DOMParser: a good number of real feeds are not well-formed
 * XML, and DOMParser's response to that is a parsererror document rather than the ninety per
 * cent of the content that was fine.
 */
export function parsePodcastFeed(xml: string, maxEpisodes = 20): ParsedFeed {
  if (!xml || typeof xml !== 'string') return { description: '', episodes: [] }

  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []

  // Channel-level description only: the first <description> in the document would otherwise be
  // an episode's whenever the channel does not carry one.
  const channel = xml.split(/<item[\s>]/i)[0] ?? ''
  const description = tagText(channel, ['itunes:summary', 'description', 'itunes:subtitle'])

  const episodes: ParsedFeedEpisode[] = []
  for (const item of items.slice(0, maxEpisodes)) {
    const title = tagText(item, ['title'])
    if (!title) continue
    episodes.push({
      title,
      pubDate: tagText(item, ['pubDate']),
      description: tagText(item, ['itunes:summary', 'description'])
    })
  }

  return { description, episodes }
}
