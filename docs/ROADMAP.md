# Podshelf roadmap

Ideas captured as they came up, with notes on what each would actually take. Nothing here is
committed to or scheduled — this is the record, not a plan.

## 1. Minimal mode — one button

A mode where the entire app is a single play/pause control plus speed and seek, and the app
decides what to play next by reading the library itself.

The listening model behind this already exists: Catch Up is oldest-first across subscribed shows.
"Minimal mode" is mostly a chrome-removal exercise over that queue, which means a first version
needs no model at all — the ordering rules (unplayed first, finish what was started, respect
show priority, don't replay finished) are the thing worth getting right, and they are testable
pure functions.

Constraint stated: no paid inference. Anything model-backed has to run on a free/open API or on
device, and has to degrade to the deterministic queue when it is unavailable. Worth treating the
deterministic queue as the product and the model as an optional re-ranker, not the other way
round.

**Status: a first version shipped.** `composables/useListeningQueue.ts` holds the ordering rules
as pure functions - finished dropped, per-podcast rules applied, oldest first, and started
episodes ahead of everything when asked. Catch up and minimal mode both read it, so there is one
answer to "what plays next" rather than one per screen. `pages/minimal.vue` is the chrome-free
surface: play/pause, jump, speed, skip, and how many are left. No model, no new playback path.

Left for later: the optional re-ranker on top, and a way in from outside the app (a launcher
shortcut or a quick-settings tile) so minimal mode does not have to be reached through settings.

## 2. iOS at Android parity

Cross-platform Podshelf. The web layer is shared already; the gap is the native side — the
Media3 player, the download service, the progress syncer and the database all have Kotlin
implementations with no Swift counterpart. This is the largest item on the list by some margin
and is worth scoping properly before any of it starts.

## 3. Wear OS

Standalone watch playback: catch-up queue plus offline caching on the watch, so a run does not
need the phone. Needs its own module, its own (small) media service and its own download path;
the watch cannot reuse the phone's. The minimal surface — one queue, play/pause, skip, caching —
is close to idea 1, which is an argument for doing 1 first and letting the watch inherit it.

## 4. Suggestion and discovery

The stickiness argument: Netflix and Hulu keep people because they answer "what next". Podcasts
have the same problem and self-hosted apps generally ignore it.

Interesting angle raised: listening *journeys* — someone working through a marathon-length show
is in a particular mood, and the useful suggestion is another long-form one, or something
adjacent to the activity (running, exercise) rather than the topic. Activity and shape of
listening as signals, not just genre.

Open question: where the catalogue comes from. The server knows only what is subscribed, so
discovery means reaching a directory (Podcast Index is already wired in for search).

## 5. Cross-podcast story summarisation

Several news shows cover the same story on the same day. Pull the segments about one story
together so it can be heard, or read, in one place.

The hard part is not summarising, it is segmentation and identifying that two shows are talking
about the same story — which needs transcripts. Some feeds carry them (podcast:transcript in the
namespace); most do not, and generating them locally is expensive. Worth checking transcript
availability across the user's own feeds before anything else — that single number decides
whether this is feasible.

## 6. Statistics as something worth opening

The stats area exists and is buried. Make it prominent and make it fun — badges, achievements, a
bit of gamification.

Year in Review already exists and is the strongest thing in there. The shareable-image path is
built, so achievements have somewhere to live.

**Status: badges and streaks shipped.** `composables/useAchievements.ts` holds the streak rule
and an 18-badge ladder across listening time, episodes finished, streak length and days listened,
all as pure functions. The stats page leads with the current streak and the nearest unearned
badge, then the wall.

The streak rule came out of a `while (true)` loop inside `DailyListeningChart`, which nothing
could reach; the chart now reads the shared one, so the number on the chart and the number behind
the badges cannot disagree.

The page itself was then rebuilt mobile-first: it had been a desktop layout with `md:`
breakpoints, a fixed `w-80` session column and a chart scaled to 90% to make it fit. The chart
measures its container now instead of assuming 384px, so it fills a tablet and fits a phone
without being shrunk, and its gridlines use a token rather than `bg-white/10`, which was
invisible on the light theme.

Reachability: a streak chip sits next to "Catch up" on the home screen and is the way in. It
renders nothing until there is a streak to show - a chip reading "0 days" on a new install is a
scolding, not an invitation.

Left for later: sharing a badge could reuse the Year in Review image path.

## 7. Steal from Plexamp

Named as a favourite: opinionated, snarky, and it simply works. Worth a proper study rather than
a feature list — what it does with mood and continuation, how it handles offline, how it talks to
the user, and how much personality the UI carries.

**Status: studied.** See [PLEXAMP_STUDY.md](PLEXAMP_STUDY.md). The headline finding is that the
most magical-seeming feature, Mood Radio, is a shuffled query over album mood tags — its author
says so on the forum — and that what carries it is the *naming*, not the mechanism. Named
characters (DJ Stretch, DJ Contempo, moods called *swaggering* and *poignant*) are what make
people choose one behaviour over another.

Four things to steal, none of which need inference: named queue modes over the ordering rules
that already exist; a "fill my 40-minute commute" queue, since podcasts have a budget music does
not; a bounded self-evicting cache of what is coming next; and release notes written with
Plexamp's candour. The "snarky" reading turned out to be wrong — the voice is specificity, not
jokes, which is a bar any project can clear by deciding to.

## 8. Per-episode comments, distributed

A comment section per episode shared across all Podshelf users, anonymous, with nothing stored on
anyone's own server — some third-party or distributed layer per episode.

The identifier is the easy part: an episode has a GUID and an enclosure URL that are stable
across every listener, so there is a natural key without any central catalogue. The hard parts
are moderation, abuse, and who pays for the storage — and all three get harder, not easier, with
no server to point at. Worth deciding early whether this is "comments" or something narrower and
cheaper to defend, like timestamped reactions.

---

## Already in flight

- Rename to Podshelf, new palette and mark
- Screenshot harness that renders the app (done — `npm run screenshots`)
- Fold posture (tabletop/book mode) for large foldables
- Cast crash on play, unconfirmed and awaiting a logcat capture
