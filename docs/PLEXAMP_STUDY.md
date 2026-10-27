# Studying Plexamp

Roadmap item 7 asked for "a proper study rather than a feature list — what it does with mood and
continuation, how it handles offline, how it talks to the user, and how much personality the UI
carries." This is that study, written against those four questions, plus what does and does not
transfer to a podcast app with no budget for inference.

**On the sources.** Most of what is publicly documented about Plexamp is Plex's own blog posts,
launch coverage from 2021–2023, and the release-notes thread on the Plex forum. plex.tv, Medium
and the Expo blog all refuse automated fetches (403), so the Plex blog is cited through coverage
of it rather than read directly. No independent design review with screenshots turned up. Where
something is a single forum post rather than documentation, it is marked as such. Treat feature
availability as dated.

---

## 1. Mood and continuation

Plexamp's continuation features, roughly in order of ambition:

| Feature | What it does | What powers it |
|---|---|---|
| Track / Album Radio | Endless play from one seed | Sonic similarity |
| Mixes For You | Clusters recent heavy rotation, adds similar albums | Sonic similarity |
| Sonic Adventure | You pick a **start** and a **destination** track; it fills the path between them | Sonic similarity |
| Guest DJ | Named personas: DJ Stretch (sonic transitions), DJ Contempo (same era), DJ Groupie (one artist) | Mixed; some need sonic analysis |
| Mood Radio | Stations named brooding, cathartic, confident, intense, playful, poignant, swaggering, wistful | **Album mood tags from metadata** |
| Time Travel Radio | Starts with oldies, walks forward to the present | Release dates |
| Sonic Sage | Natural-language playlist requests | OpenAI API key you supply |

### The finding that matters most

**The most magical-sounding feature is the least clever one.** Mood Radio — the thing that reads
as "the app understands how I feel" — is a shuffled query over albums tagged with that mood in
the metadata. A forum thread complains about exactly the failure that implies: *Candle In The
Wind* turns up on Happy Radio because its album carries the Happy tag, and users who carefully
tag at track level find Plexamp ignores them.

The reply from Plex's own developer is the useful part. Track-level mood data is sparse in the
metadata they receive, so they were reluctant to build on it; per-user tags are not supported at
all, on the stated principle of *"Same Great Metadata for all users"*; and playlists named
"workout" or "dinner party" are offered as the substitute.

So: a feature that feels like understanding is a tag query with good naming, and its author knows
it, and it is still one of the most-loved things in the app.

### The second finding: naming is the feature

"DJ Stretch", "DJ Contempo", "DJ Groupie". Moods called *swaggering* and *poignant* rather than
*upbeat* and *sad*. *Sonic Adventure* rather than "interpolate between two tracks". None of these
names describe a mechanism; each describes a **character**, and the character is what makes the
user choose one.

Compare a settings screen with a "transition smoothness" slider. Same mechanism, no appeal.

### The third: continuation is framed as a journey with a shape

Sonic Adventure is the clearest expression of the roadmap's own "listening journeys" idea — it
does not ask "what is similar to this", it asks "get me from **here** to **there**, gradually".
Time Travel Radio has the same property: a direction, not a pool.

---

## 2. Offline

Plexamp has two distinct mechanisms, and the distinction is the interesting part:

- **Downloads** — explicit, user-chosen, and *capped*: a single playlist download is limited to
  about 24 hours of total duration for performance reasons. The library is deliberately not
  something you mirror.
- **A recently-played cache** — separate from downloads, with a size limit set in
  Settings → Downloads and **oldest-played-first eviction**. Tracks played offline count toward
  it. (This is described in a forum post about a preview build; whether it reached stable is
  unconfirmed.)
- **Offline plays sync back** when the server is reachable again — with at least one user
  reporting it is not perfectly reliable.
- Upcoming tracks are pre-cached so playback survives a connection drop mid-queue.

The shape of this is: *explicit downloads for what you chose, an automatic cache for what you
happen to be listening to, and a hard cap on both.*

---

## 3. How it talks to the user

The roadmap's note records Plexamp as "opinionated, snarky". Having read a stretch of the actual
release notes, that is not quite what is going on, and the real mechanism is more reproducible
than snark.

The release notes are **dense, itemised, per-platform, and overwhelmingly about fixes**. A single
release lists the track-title ticker flickering, a gain cap added to guard against bad analysis,
a menu item that did nothing, CarPlay showing a black screen, Linux starting up silently, and
Android crashing on a track with broken analysis. Embarrassing bugs are named as plainly as
features.

The personality is one line of warmth on top of that: *"We have some bug-fixes to brighten up
your weekend!"*, *"It's been a hot minute!"*, *"Just the one fix."*, and a heading joking that
software is never perfect.

**The voice is candour, not comedy.** It reads as personality because the specificity is unusual
— most apps ship "bug fixes and performance improvements" — not because the jokes are good. That
is a bar any project can clear by deciding to.

---

## 4. How much personality the UI carries

The signature is **UltraBlur**: dominant colours are extracted from the album art and rendered as
a blurred, smoked-glass backdrop behind the player. Plex's engineering write-up is explicit that
naive blurring is *not* good enough, because album covers carry text and borders which smear into
the result — so the colours are extracted and re-rendered rather than the image being blurred in
place.

Beyond that: multiple themes and skins, visualizers you reach by tapping the artwork, and a
general verdict in third-party reviews that it is cleaner than the main Plex app. Plex's own copy
tells you to pick the dark theme "to enjoy beautiful Ultrablur backgrounds" — the art direction
has a preferred setting and says so.

The personality is concentrated in **one strong idea applied consistently** (the artwork colours
the room), not spread across lots of decoration.

---

## What transfers to Podshelf

Ranked by value per unit of work, and all of it compatible with the no-paid-inference rule.

### 1. Name the queue's behaviours, and let people choose between them

Podshelf already has the machinery: `orderListeningQueue` takes options, and `resumeFirst` is
already one behaviour distinct from another. What it lacks is Plexamp's insight that these should
be **named characters the user picks**, not flags.

Concretely: the same pure function behind two or three named modes — *Catch Up* (oldest first,
what exists today), *Short Hop* (fills the time you have, shortest-first), *One Show* (stay with
a single podcast). Each is a sort and a filter over a list the app already has. No model, no
network, and it is testable the way the rest of the queue rules are.

This is the cheapest thing on the list and the closest to what made Plexamp's Guest DJ land.

### 2. A "get me from here to there" queue

Sonic Adventure's shape translates to podcasts better than it has any right to, because a podcast
queue has a budget nobody else has: **time**. "I have a 40-minute commute" is a destination.
Filling it exactly — rather than starting a 4-hour episode of *Hardcore History* — is a real
feature that needs only episode durations, which Podshelf already has.

### 3. A cache with a cap and an eviction rule

Podshelf has auto-download settings; what it does not have is Plexamp's *separate, bounded,
self-evicting* cache of what is coming next in the queue. The rules — how much, evict
oldest-played-first, count offline plays — are exactly the kind of decision logic this repo keeps
in a pure function. The offline audit already established that the queue knows what is on disk.

### 4. Write release notes like that

Nothing to build. The repo already writes unusually specific commit messages; the gap is that
none of it reaches a user. A `CHANGELOG.md` in that voice, fed from the commits, is most of the
distance.

### 5. Let the artwork colour the room — and finish the job

Podshelf already derives `coverRgb` and already tints the item page and the player background
with it. Two things are worth taking from UltraBlur: the extracted-colour approach beats blurring
the image (which Podshelf is not doing, correctly), and the effect should be applied
*consistently* rather than on two screens. Minimal mode in particular is a large square of
artwork on a flat surface and is the obvious place for it.

---

## What does not transfer

- **Sonic analysis.** It is CPU-heavy enough to take hours or days on a large library, requires a
  Plex Pass, and does not run on ARM. Podshelf's server is somebody's home machine, often a Pi.
  Even if an audio-similarity model were free, the compute is not, and podcasts are speech —
  timbre similarity is close to meaningless across two people talking.
- **Metadata-supplied moods.** Plexamp's moods come from a commercial music metadata pipeline.
  Podcast feeds carry nothing equivalent. Mood Radio is not portable, only its *naming* is.
- **"Same Great Metadata for all users."** This is Plex's constraint, not Podshelf's — and it is
  the one place where Podshelf can simply beat it. A self-hosted podcast app has one user, or a
  handful, so **per-user tagging is available to it**. The per-podcast rules already in
  `useAutoPlaylist` are exactly that, and the thing Plex's developer told users he could not give
  them.
- **Sonic Sage as a model.** Worth noting as precedent rather than a feature: the one
  LLM-backed thing in Plexamp is optional, off by default, and runs on **an API key the user
  supplies**. That is a reasonable template for roadmap item 1's "optional re-ranker" if it ever
  happens — it keeps the deterministic queue as the product and makes the model a thing the user
  opts into and pays for themselves.

---

## Sources

- [Plex's new feature matches your 'sonically similar' music to make playlists — TechCrunch](https://techcrunch.com/2021/08/12/plexs-new-feature-matches-your-sonically-similar-music-to-make-playlists/)
- [Plex using sonic analysis for upgraded Plexamp — 9to5Mac](https://9to5mac.com/2021/08/12/plex-brings-sonic-analysis-plexamp-music-app/)
- [Plexamp's Sonic Sage Uses ChatGPT to Help You Discover New Music — Sound & Vision](https://www.soundandvision.com/content/plexamp-s-sonic-sage-uses-chatgpt-improved-discovery)
- [Plexamp adds "Sonic Sage" — PR Newswire](https://www.prnewswire.com/news-releases/plexamp-adds-sonic-sage-chatgpt-based-feature-for-creating-incredible-playlists-301814850.html)
- [Plex's Winamp-inspired music player Plexamp is now free — TechCrunch](https://techcrunch.com/2023/07/18/plexs-winamp-inspired-music-player-plexamp-is-now-free/)
- [A Plea to Fix Mood Radio — Plex Forum](https://forums.plex.tv/t/a-plea-to-fix-mood-radio/842251) — the album-tag mechanism and the developer's reply
- [Plexamp Release Notes — Plex Forum](https://forums.plex.tv/t/plexamp-release-notes/221280/49) — the voice, read directly
- [PlexAmp full Offline controls and support — Plex Forum](https://forums.plex.tv/t/plexamp-full-offline-controls-and-support/575495)
- [Allow Cached Content To Be Played Offline — Plex Forum](https://forums.plex.tv/t/allow-cached-content-to-be-played-offline/849092)
- [A Guide to Plexamp — Supermarket Sound](https://supermarketsound.com/guides/music-streaming-plexamp-guide/)
- [Guest DJs: Cool new Plexamp Feature — Audiogon](https://forum.audiogon.com/discussions/guest-djs-cool-new-plexamp-feature/post?postid=2488607)
- [Plexamp review — Computer & Technology Network](https://www.ctnet.co.uk/plex-amp-a-review/)
- [Plexamp refreshed for desktop and mobile (2026) — The Desk](https://thedesk.net/2026/09/plexamp-new-app-desktop-windows-mac-linux/)
