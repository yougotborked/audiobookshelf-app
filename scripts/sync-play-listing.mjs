// Pushes the Play Store listing - text and graphics - from this repository to Play.
//
// Everything in a Play listing except the app record itself can be set through the Publishing
// API, so none of it needs to be typed into the Console twice or kept in step by hand. The copy
// lives in docs/store/listing.<language>.json and the graphics in docs/store/, both reviewable
// in a diff.
//
//   node scripts/sync-play-listing.mjs --dry-run     validate, change nothing
//   node scripts/sync-play-listing.mjs               apply and commit the edit
//
// Credentials come from PLAY_SERVICE_ACCOUNT_JSON (the whole key file, as a string) or
// PLAY_SERVICE_ACCOUNT_FILE (a path). The same secret the publish workflow uses.
//
// What this cannot do, because Google provides no API for it: create the app, answer the content
// rating questionnaire, or fill in the data safety form. See docs/PLAY_STORE.md.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const STORE = path.join(ROOT, 'docs', 'store')
const PACKAGE_NAME = 'com.podshelf.app'
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher'
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3'
const UPLOAD = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3'

// Play's own limits. Exceeding one fails the commit with a message that does not say which
// field, so they are checked here first.
const TEXT_LIMITS = { title: 30, shortDescription: 80, fullDescription: 4000 }

const DRY_RUN = process.argv.includes('--dry-run')

/** Graphics to upload, by Play's image type. Anything missing on disk is skipped, not an error. */
const IMAGES = [
  { type: 'icon', file: 'icon-512.png' },
  { type: 'featureGraphic', file: 'feature-graphic-1024x500.png' },
  ...fs
    .readdirSync(path.join(STORE, 'screenshots'), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.png'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => ({ type: 'phoneScreenshots', file: path.join('screenshots', e.name) }))
]

function loadServiceAccount() {
  const inline = process.env.PLAY_SERVICE_ACCOUNT_JSON
  const fromFile = process.env.PLAY_SERVICE_ACCOUNT_FILE
  const raw = inline || (fromFile && fs.readFileSync(fromFile, 'utf8'))
  if (!raw) {
    throw new Error(
      'Set PLAY_SERVICE_ACCOUNT_JSON (contents) or PLAY_SERVICE_ACCOUNT_FILE (path). See docs/PLAY_STORE.md.'
    )
  }
  const key = JSON.parse(raw)
  if (!key.client_email || !key.private_key) {
    throw new Error('Service account key is missing client_email or private_key')
  }
  return key
}

const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/**
 * Exchanges the service account key for an access token.
 *
 * Signed here with Node's own crypto rather than pulling in google-auth-library: it is a header,
 * a claim set and one RS256 signature, and this repository has no other need for the dependency.
 */
async function getAccessToken(key) {
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: key.client_email,
    scope: SCOPE,
    aud: key.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }
  const signingInput = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claims))}`
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(key.private_key)
  const assertion = `${signingInput}.${signature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`

  const res = await fetch(claims.aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`Token request failed (${res.status}): ${JSON.stringify(body)}`)
  return body.access_token
}

async function api(token, method, pathname, { json, body, contentType } = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(contentType ? { 'Content-Type': contentType } : {})
    },
    body: json ? JSON.stringify(json) : body
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${pathname} failed (${res.status}): ${text}${hintFor(res.status)}`)
  return text ? JSON.parse(text) : {}
}

/**
 * Play answers a permissions gap with a bare "The caller does not have permission", which does
 * not say which permission or where to grant it.
 *
 * The one that catches people is Manage store presence: without it a service account can still
 * authenticate, open an edit and upload every image - everything appears to work - and only the
 * commit is refused, because that is where Play checks whether the listing may actually change.
 */
function hintFor(status) {
  if (status !== 403) return ''
  return [
    '',
    '',
    'A 403 here is almost always a Play Console permission, not a Google Cloud one.',
    'Play Console -> Users and permissions -> the service account -> App permissions:',
    '  - Manage store presence   <- required to commit a listing change',
    '  - Release to testing tracks',
    '  - View app information and download bulk reports',
    '',
    'Permission changes can take a few minutes, occasionally up to 24 hours, to reach the API.',
    'If you have just granted it, wait and re-run before changing anything else.'
  ].join('\n')
}

async function uploadImage(token, editId, language, imageType, filePath) {
  const res = await fetch(
    `${UPLOAD}/applications/${PACKAGE_NAME}/edits/${editId}/listings/${language}/${imageType}?uploadType=media`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
      body: fs.readFileSync(filePath)
    }
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`Upload of ${imageType} failed (${res.status}): ${text}`)
}

// ── Validate first, so a dry run is a real check and not a guess ──────────────────────────────

const listingFiles = fs
  .readdirSync(STORE)
  .filter((f) => /^listing\..+\.json$/.test(f))
  .map((f) => path.join(STORE, f))

if (!listingFiles.length) throw new Error(`No listing.<language>.json found in ${STORE}`)

const listings = listingFiles.map((file) => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const [field, limit] of Object.entries(TEXT_LIMITS)) {
    const value = data[field]
    if (typeof value !== 'string' || !value.length) {
      throw new Error(`${path.basename(file)}: ${field} is missing`)
    }
    if (value.length > limit) {
      throw new Error(`${path.basename(file)}: ${field} is ${value.length} characters, Play allows ${limit}`)
    }
  }
  if (!data.language) throw new Error(`${path.basename(file)}: language is missing`)
  return data
})

const images = IMAGES.map((image) => ({ ...image, path: path.join(STORE, image.file) })).filter(
  (image) => {
    const exists = fs.existsSync(image.path)
    if (!exists) console.warn(`  (skipping ${image.file} - not generated yet)`)
    return exists
  }
)

console.log(`Listings: ${listings.map((l) => l.language).join(', ')}`)
for (const [field, limit] of Object.entries(TEXT_LIMITS)) {
  console.log(`  ${field}: ${listings[0][field].length}/${limit}`)
}
console.log(`Images: ${images.length}`)
for (const image of images) console.log(`  ${image.type}  ${image.file}`)

if (DRY_RUN) {
  console.log('\nDry run - everything validates, nothing sent.')
  process.exit(0)
}

// ── Apply ─────────────────────────────────────────────────────────────────────────────────────

const key = loadServiceAccount()
const token = await getAccessToken(key)
console.log(`\nAuthenticated as ${key.client_email}`)

const edit = await api(token, 'POST', `/applications/${PACKAGE_NAME}/edits`, { json: {} })
console.log(`Opened edit ${edit.id}`)

try {
  for (const listing of listings) {
    await api(token, 'PUT', `/applications/${PACKAGE_NAME}/edits/${edit.id}/listings/${listing.language}`, {
      json: {
        language: listing.language,
        title: listing.title,
        shortDescription: listing.shortDescription,
        fullDescription: listing.fullDescription
      }
    })
    console.log(`  text -> ${listing.language}`)
  }

  // Screenshots replace rather than accumulate: without this, every run appends another copy
  // until Play rejects the edit for having too many.
  const language = listings[0].language
  for (const imageType of [...new Set(images.map((i) => i.type))]) {
    await api(
      token,
      'DELETE',
      `/applications/${PACKAGE_NAME}/edits/${edit.id}/listings/${language}/${imageType}`
    )
  }
  for (const image of images) {
    await uploadImage(token, edit.id, language, image.type, image.path)
    console.log(`  image -> ${image.type}  ${image.file}`)
  }

  await api(token, 'POST', `/applications/${PACKAGE_NAME}/edits/${edit.id}:commit`, { json: {} })
  console.log('\nCommitted.')
} catch (error) {
  // An abandoned edit leaves nothing behind; a half-applied one would be worse than none.
  await api(token, 'DELETE', `/applications/${PACKAGE_NAME}/edits/${edit.id}`).catch(() => {})
  console.error('\nEdit abandoned, nothing was changed.')
  throw error
}
