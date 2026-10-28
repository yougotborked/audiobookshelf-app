# Publishing Podshelf to Google Play

What the repository already does, and what only a human with the Play Console can do.

**Automated:**

- `.github/workflows/publish-play.yml` — on a `v*` tag, builds a signed AAB, derives the version
  from the tag, uploads it to a Play track.
- `.github/workflows/sync-play-listing.yml` — pushes the title, descriptions, icon, feature
  graphic and screenshots from `docs/store/` whenever that content changes on master. The
  listing lives in the repo and is reviewable in a diff rather than typed into the Console.

**Not automatable, because Google exposes no API for it:**

- Registering the developer account — it is identity verification, deliberately human.
- **Creating the app record.** The Publishing API only operates on apps that already exist;
  there is no create method for a public app. (`playcustomapp.accounts.customApps.create` exists
  but is for private enterprise apps.)
- The content rating questionnaire and the data safety form — legal declarations.
- Granting the service account permission in Play Console.

**Not automated on purpose:** generating the upload key. A private key that passes through a
terminal, a chat window or a CI log is a key you have to treat as compromised. Step 3 is one
command you run yourself.

Everything below is one-time. After it, releases and listing updates are a `git tag` and a
`git push`.

---

## 0. Know the gate before you start

If your Play account is a **personal** account created after 13 November 2023, you cannot publish
to production until you have run a **closed** test with at least **12 testers opted in
continuously for 14 days**, and then applied for production access — and meeting the bar only
makes you eligible, it is not automatic
([Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465)).

**Internal testing does not count toward that.** Only the closed track does.

If the only person using this is you, stop at **internal testing**: up to 100 testers, live within
minutes, no gate and no waiting, and you get the app on your phone from Play with automatic
updates. That is most of the benefit for none of the cost. Production can wait until there is a
reason for it.

---

## 1. Play Console account

1. Register at [play.google.com/console](https://play.google.com/console) — US$25, one time.
2. Complete identity verification. This can take a few days.
3. Organization accounts (which need a D-U-N-S number) are reportedly exempt from the
   12-tester gate; personal accounts are not. Worth confirming against the help page above if
   that difference matters to you.

## 2. Create the app

In the Play Console, create an app with package name **`com.podshelf.app`**.

This must match `applicationId` in `android/app/build.gradle` exactly, and **can never be changed
afterwards**. The publish workflow assumes the app already exists; it uploads to it, it does not
create it.

Accept **Play App Signing** when offered. Google then holds the real app signing key and you hold
only an *upload* key — which means a lost upload key can be reset, rather than ending the app.

## 3. Generate the upload key

```shell
keytool -genkeypair -v \
  -keystore podshelf-upload.jks \
  -alias podshelf-upload \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Podshelf, O=Podshelf, C=US"
```

Without `-dname`, keytool asks for a name, organisation, city, state and country. **None of it has
to be real.** Those fields are X.509 certificate metadata; under Play App Signing, Google re-signs
the app with a key it holds, and Android never shows a certificate to the user. `-dname` above just
answers them up front. Pressing Enter through the prompts is equally fine — the fields become
`Unknown`.

Two things that *do* matter. The DN is readable from any signed artifact
(`apksigner verify --print-certs`), so do not put a home address in it. And let keytool prompt for
the password rather than passing `-storepass`, which would leave it in your shell history.

Keep `podshelf-upload.jks` and its passwords somewhere you will still have them in five years —
a password manager, not this repository. **Never commit it.** `.gitignore` does not need to cover
it because it should not live in the working tree at all.

Then base64 it for the GitHub secret:

```shell
base64 -w0 podshelf-upload.jks > podshelf-upload.jks.base64
```

## 4. GitHub secrets

Repository → Settings → Secrets and variables → Actions. The workflow checks all five are present
before it builds and fails with a readable message if any is missing.

| Secret | Value |
|---|---|
| `PLAY_UPLOAD_KEYSTORE_BASE64` | contents of `podshelf-upload.jks.base64` |
| `PLAY_KEYSTORE_PASSWORD` | keystore password from step 3 |
| `PLAY_KEY_ALIAS` | `podshelf-upload` |
| `PLAY_KEY_PASSWORD` | key password from step 3 |
| `PLAY_SERVICE_ACCOUNT_JSON` | the whole JSON file from step 5 |

The workflow uses a `play` [environment](https://docs.github.com/en/actions/deployment/targeting-different-environments),
so you can scope these secrets to it and add a required reviewer if you ever want a manual gate
before anything reaches Play.

## 5. Service account, so CI can upload

Most of this is scripted. Run it signed in as yourself — it needs your Google credentials, which
is why it is a script you run rather than something done for you:

```shell
gcloud auth login
bash scripts/setup-play-service-account.sh
```

It creates the project, enables the Google Play Android Developer API, creates the service
account and writes a key file. It grants no project-level IAM role on purpose: publishing rights
come from Play Console, and a role here would widen what the key reaches without helping.

Two steps it cannot do, and prints instructions for:

1. **Invite the service account in Play Console** → *Users and permissions* → *Invite new user*,
   and grant it, for this app:
   - **Manage store presence** — required to sync the store listing. Without it the service
     account can still authenticate, open an edit and upload every image, and only the final
     commit is refused with a bare "The caller does not have permission".
   - *Release to testing tracks*
   - *View app information and download bulk reports*
   - *Release to production* — only if you want tagged builds to go live.

   There is no API for granting Play Console access. Permission changes can take minutes, and
   occasionally up to 24 hours, to reach the API: if a 403 persists straight after granting one,
   wait and retry before changing anything else.
2. **Add the key as `PLAY_SERVICE_ACCOUNT_JSON`**, then delete the local copy. A key file left in
   a working tree is a key that eventually gets committed.

## 6. Store listing assets

Generated from the app and its mark, so they cannot drift from it:

| Asset | Where | Regenerate with |
|---|---|---|
| Icon, 512×512 | `docs/store/icon-512.png` | `npm run store:assets` |
| Feature graphic, 1024×500 | `docs/store/feature-graphic-1024x500.png` | `npm run store:assets` |
| Phone screenshots, 1080×1920 | `docs/store/screenshots/` | `npm run screenshots` |

**Retake the screenshots on a real device before you publish.** The generated ones come from the
test harness against mock data, so they carry two artifacts: the home screen shows a stub
"Test Book" placeholder from the web database stub, and every screen shows the offline badge
because the harness never connects a socket. They are a usable starting point and the right
sizes; they are not a good listing.

The listing copy lives in `docs/store/listing.en-US.json` and is pushed by
`npm run store:listing` (or the sync workflow). Validate it without sending anything:

```shell
node scripts/sync-play-listing.mjs --dry-run
```

That checks Play's length limits — title 30, short description 80, full description 4000 — which
otherwise fail the commit with a message that does not say which field. Adding another language
is another `listing.<language>.json` beside it.

**Privacy policy URL** — required, even though the app collects nothing:

```
https://yougotborked.github.io/podshelf-app/privacy.html
```

It is published automatically with the test page on every push to master, from
`.github/privacy-policy.html`.

## 7. Data safety form

Answers that match what the code actually does, as of this writing — a scan found no analytics,
crash reporting or advertising SDK, and the only third-party host contacted is Podcast Index:

- **Does your app collect or share any of the required user data types?** → **No**.
- **Is all user data encrypted in transit?** → Yes, assuming your server uses HTTPS. The app also
  allows plain HTTP, because self-hosted servers on a LAN often have no certificate; say so if
  the form gives you room.
- **Do you provide a way for users to request data deletion?** → There is no account and no
  server of ours to delete from. Uninstalling removes everything local.

Two things are worth mentioning in the listing description rather than hiding:

- Searching for a new podcast sends the search terms to `api.podcastindex.org`.
- Everything else goes only to the Audiobookshelf server the user configures.

Re-check this form whenever a dependency is added that talks to the network.

## 7b. Foreground service declaration

Play asks what each foreground service permission is for. The answers follow from the manifest,
so they are recorded here rather than re-derived every release.

| Permission | Declared by | Answer |
|---|---|---|
| `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | `PlayerNotificationService` (`mediaPlayback`) | **Media playback** |
| `FOREGROUND_SERVICE_DATA_SYNC` | `DownloadService` (`dataSync`) | **Network processing → Other** |

Not *Backing up, restoring* — nothing here is a backup. Description, if asked:

> Downloads podcast episodes the user has selected, or enabled auto-download for, from their
> self-hosted Audiobookshelf server so they can be played without a connection. A progress
> notification is shown for the duration. The service runs in the foreground so a download
> completes while the user is in another app rather than restarting.

Play often asks for a short video for a `dataSync` declaration. Filming a download starting, the
notification showing progress, and the episode playing offline afterwards covers it.

## 7c. The two upload warnings, and why both are ignorable

**"No deobfuscation file."** `minifyEnabled` is false, so nothing is obfuscated and there is no
mapping file to upload. The warning is conditional on using obfuscation. The upside is that crash
stack traces arrive readable.

**Do not enable R8 to silence it.** Three dependencies resolve types reflectively — Jackson
serialises every data class, paperdb does the same for storage, and Capacitor resolves plugins by
name. Without correct keep rules those fail *at runtime, not at build time*: the unit tests stay
green and the app breaks on a device. It is a deliberate piece of work with a device pass, not a
pre-launch tweak.

**"No native debug symbols."** The bundle contains one native library,
`libandroidx.graphics.path.so`, which comes from AndroidX and ships stripped. This project builds
no native code — there is no `externalNativeBuild` — so there is no symbol file to produce.
`ndk.debugSymbolLevel` only covers native code the project compiles itself. Unactionable.

## 8. Listing copy

- **App name:** Podshelf
- **Short description:** A podcast player for your own Audiobookshelf server.
- **Full description:** start from `readme.md`, which already describes the catch-up workflow,
  Android Auto and offline behaviour.
- **Category:** Music & Audio
- Say plainly that it **requires an Audiobookshelf server** and provides no content. The old
  upstream string already in the app says this; the listing should too, or you will get
  one-star reviews from people who installed it expecting a podcast directory.
- Do not imply any affiliation with the Audiobookshelf project. Podshelf is an independent fork;
  describe it as a client *for* an Audiobookshelf server.

### Tags

Up to five, from Google's fixed list under **Grow users → Store presence → Store settings →
Manage tags**. Not free text.

**There is no Podcast tag.** The audio-related ones are: Audio recorder, Audiobook, Music &
audio, Music instrument, Radio, Ringtone, Sound effect, Karaoke, Guitar, Lyrics. Only two of them
are honest here:

1. **Audiobook** — true (Podshelf is an Audiobookshelf client and plays books), and it reaches
   people already running a server, who are the actual audience.
2. **Music & audio** — generic, but accurate.

That is the whole list. Two is fine; Google assigns further tags on its own, and padding with
inaccurate ones is worse than leaving slots empty.

**Not Radio**, however adjacent podcasts feel. Radio means streamed stations. Someone searching
it would install Podshelf, find an app that needs a server they do not have, and leave a one-star
review — which a new listing with no ratings cannot absorb. It is the only other tempting tag and
it is a trap.

**Because no Podcast tag exists, the word has to reach Play search through the title and
descriptions**, which Play indexes. The title has a 30-character budget and currently uses 8:

| Title | Length |
|---|---|
| `Podshelf` | 8 |
| `Podshelf: Podcast Player` | 24 |
| `Podshelf: Self-hosted Podcasts` | 30 |

A store title is not the launcher name — changing it does not rename the app on anyone's device.
Weigh discoverability against wanting the brand to stand alone.

Tag changes take up to 24 hours to appear, and Google suggests changing them only after
significant feature changes.

## 9. Publish

Everything above is one-time. After that:

```shell
git tag v0.13.0
git push origin v0.13.0
```

A tag publishes to **closed testing** (`alpha`), and deliberately leaves the watch bundle out —
see the three Play Console steps above. Run the workflow from the Actions tab to choose a
different track, or to include the watch once its listing exists.

Promoting between tracks afterwards is a Play Console action rather than a re-upload: a version
code can only be uploaded once, so the track here decides where a release *lands*, not where it
can ever go.

The workflow builds **two** signed AABs — the phone app and the Wear OS app — derives
`versionName 0.13.0` and `versionCode 1300` from the tag, and uploads both to the **internal**
track as one release.

To send a build to another track, run the workflow manually from the Actions tab and choose the
track and version.

### Version numbering

The tag must be `vMAJOR.MINOR.PATCH`; anything else is rejected before a build starts. The
versionCode is `major × 10000 + minor × 100 + patch`, so it always increases with the version —
Play refuses a versionCode it has already seen, and refuses to go backwards. Minor and patch must
each stay under 100.

The first tagged build gets versionCode ≥ 1200, comfortably above the 116 the debug builds use,
so there is no collision with anything already installed.

### Before the watch can go to Play at all

Three things have to exist in Play Console first, and none of them is code. Play fails the
**whole release** if a Wear artifact arrives before they do — not just that artifact — so an
unconfigured watch listing blocks the phone release with it.

1. **Add the Wear OS form factor.** Test and release → Advanced settings → Form factors →
   **+ Add form factor** → Wear OS. Until this is done there is nowhere to put a watch build or
   its screenshots.
2. **At least one Wear OS screenshot**, taken on a real watch or an emulator: 1:1, at least
   384 × 384, the app interface only — no device frame, no added text or graphics, no
   transparency. These cannot be generated from the repository's screenshot harness, which
   drives the web app in a browser; the watch app is native Compose and needs a device.
3. **Mention "Wear OS" in the listing**, in `docs/store/listing.en-US.json`.

Until all three are in place, publish the phone alone: run the workflow from the Actions tab
with **include_wear** unchecked. The watch bundle is still built and still has to be signed and
version-correct — it is simply not sent.

### The watch's version code

The watch app ships under the same `applicationId` and the same signing key as the phone app, so
Play treats them as one listing with two device targets — one store page, one set of reviews, and
the watch app installs by itself when someone with a paired watch installs Podshelf.

Its version code must **not** equal the phone's. A version code has to be unique across every
form factor in a listing, and Play rejects a release where two artifacts share one. It is also
deliberately *higher*: a watch can match the phone artifact as well, and Play offers a device the
highest code it qualifies for.

`podshelfWearVersionCode` is therefore `podshelfVersionCode + 1000000`. A constant offset rather
than a separate counter, so the watch's codes rise exactly as often as the phone's and neither
can fall behind its own last release. `android/variables.gradle` fails the build outright if the
two ever come out equal — Play's own error names the upload rather than the codes, and an `.aab`
is not an APK, so a workflow step that tried to read the codes back out of the artifacts would
silently pass.

---

## A note on the licence

Podshelf is GPL-3.0, inherited from Audiobookshelf. Distributing GPL software through Play is
generally considered workable — the source stays public and the licence is preserved — but there
is real history around GPL and app store terms, and this is not legal advice. Worth reading up
before you publish rather than discovering it afterwards.
