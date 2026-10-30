import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// scripts/app-version.sh decides the versionCode for every build that reaches Play, and Play
// will never accept a code it has already seen. The arithmetic used to be duplicated between
// the script and the publish workflow with a comment asking the two to be kept in step; this
// exercises the one surviving copy against real git repositories, because the failures that
// actually happened were about what git reported (no tags on a shallow clone), not about the
// multiplication.
const SCRIPT = resolve(__dirname, '../scripts/app-version.sh')

let repo: string

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
}

function commit(message: string): void {
  git('commit', '--allow-empty', '-q', '-m', message)
}

function version(): { name: string; code: number } {
  const out = execFileSync('bash', [SCRIPT], { cwd: repo, encoding: 'utf8' })
  const name = /PODSHELF_VERSION_NAME=(.*)/.exec(out)?.[1] ?? ''
  const code = Number(/PODSHELF_VERSION_CODE=(.*)/.exec(out)?.[1])
  return { name, code }
}

// 1000 commits one `git commit` at a time took 80 seconds. fast-import builds the whole
// history in a single process, which is the difference between a test that runs and a test
// that gets deleted for being slow.
function appendEmptyCommits(count: number): void {
  let stream = ''
  for (let i = 0; i < count; i++) {
    const message = `filler ${i}\n`
    stream += 'commit refs/heads/master\n'
    stream += `committer Test <test@example.com> ${1_700_000_000 + i} +0000\n`
    stream += `data ${Buffer.byteLength(message)}\n${message}`
    // Only the first needs to say where it branches from; after that fast-import continues on
    // the branch it is writing.
    if (i === 0) stream += 'from refs/heads/master^0\n'
    stream += '\n'
  }
  execFileSync('git', ['fast-import', '--quiet'], { cwd: repo, input: stream })
}

function versionFails(): string {
  try {
    execFileSync('bash', [SCRIPT], { cwd: repo, encoding: 'utf8', stdio: 'pipe' })
  } catch (error) {
    return String((error as { stderr?: Buffer }).stderr ?? '')
  }
  throw new Error('expected app-version.sh to fail, but it succeeded')
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'podshelf-version-'))
  git('init', '-q', '-b', 'master')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  commit('initial')
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe('app-version.sh', () => {
  it('reports an obviously wrong version when there is no tag to go on', () => {
    // Rather than a plausible stale one: 0.12.0-beta sat in released builds for weeks after
    // 0.13.0 shipped precisely because it looked like a real version.
    expect(version()).toEqual({ name: '0.0.0-untagged', code: 1 })
  })

  it('uses the tag alone when HEAD is the tagged commit', () => {
    git('tag', 'v0.13.0')
    expect(version()).toEqual({ name: '0.13.0', code: 1_300_000 })
  })

  it('counts commits since the tag into the name and the code', () => {
    git('tag', 'v0.13.0')
    commit('one')
    commit('two')
    expect(version()).toEqual({ name: '0.13.0-dev.2', code: 1_300_002 })
  })

  it('keeps every master build above the tag it follows and below the next tag', () => {
    // The invariant Play actually enforces. A code that sorts below what a track already has
    // is rejected on upload, so this ordering is what lets master publish continuously and a
    // tag still release afterwards.
    git('tag', 'v0.13.0')
    const release = version().code

    const builds: number[] = []
    for (let i = 0; i < 5; i++) {
      commit(`after release ${i}`)
      builds.push(version().code)
    }

    expect(builds).toEqual([...builds].sort((a, b) => a - b))
    expect(Math.min(...builds)).toBeGreaterThan(release)

    git('tag', 'v0.14.0')
    expect(version().code).toBeGreaterThan(Math.max(...builds))
  })

  it('orders a patch release above the dev builds of the release before it', () => {
    git('tag', 'v0.13.0')
    commit('a fix')
    const dev = version().code
    git('tag', 'v0.13.1')
    expect(version().code).toBeGreaterThan(dev)
  })

  it('reads the numeric core of a pre-release tag', () => {
    git('tag', 'v0.14.0-rc1')
    expect(version()).toEqual({ name: '0.14.0-rc1', code: 1_400_000 })
  })

  it('refuses to wrap past the build numbers the scheme has room for', () => {
    // Wrapping would reuse a code Play has seen, which cannot be undone. Failing the build is
    // the recoverable option: tag a release and the counter starts again above the tag.
    git('tag', 'v0.13.0')
    appendEmptyCommits(999)
    expect(version().code).toBe(1_300_999)

    appendEmptyCommits(1)
    expect(versionFails()).toMatch(/exceeds the 999/)
  })

  it('rejects a tag that is not major.minor.patch', () => {
    git('tag', 'v0.13')
    expect(versionFails()).toMatch(/not v<major>\.<minor>\.<patch>/)
  })

  it('rejects a minor or patch that would overflow its two digits', () => {
    git('tag', 'v0.13.100')
    expect(versionFails()).toMatch(/must each be <= 99/)
  })
})

describe('nuxt.config.ts version derivation', () => {
  // The drawer's version string comes from here, and it used to run its own `git describe`.
  // That looked equivalent to the script and was not: the script appends the commit count, so
  // the drawer read "0.13.0" on a build whose versionName was "0.13.0-dev.79" - 79 commits
  // newer than the number it displayed. This is a guard against that third definition coming
  // back, which is the kind of drift nothing else here would notice.
  const config = readFileSync(resolve(__dirname, '../nuxt.config.ts'), 'utf8')

  it('asks scripts/app-version.sh rather than deriving its own', () => {
    expect(config).toMatch(/scripts\/app-version\.sh --name/)
  })

  it('does not call git describe itself', () => {
    // Matches an invocation, not the words: the comment above the function names `git describe`
    // to explain why it is gone, and a bare /git describe/ flagged that prose as the bug.
    expect(config).not.toMatch(/execSync\(\s*['"`][^'"`]*git describe/)
  })

  it('still lets PODSHELF_VERSION_NAME win, so CI can pin what it is building', () => {
    expect(config).toMatch(/process\.env\.PODSHELF_VERSION_NAME/)
  })
})

describe('the workflows build the web with the version already in the environment', () => {
  // nuxt.config reads PODSHELF_VERSION_NAME at `npm run generate` time. Both workflows used to
  // set it afterwards - publish-play passed it only to Gradle - which is what left the drawer
  // and Android's app info disagreeing on a shipped build.
  const order = (file: string, a: RegExp, b: RegExp) => {
    const text = readFileSync(resolve(__dirname, '..', file), 'utf8')
    const ia = text.search(a)
    const ib = text.search(b)
    expect(ia, `${a} not found in ${file}`).toBeGreaterThan(-1)
    expect(ib, `${b} not found in ${file}`).toBeGreaterThan(-1)
    return { ia, ib }
  }

  it('build-apk derives the version before generating', () => {
    const { ia, ib } = order('.github/workflows/build-apk.yml', /scripts\/app-version\.sh >> "\$GITHUB_ENV"/, /run: npm run generate/)
    expect(ia).toBeLessThan(ib)
  })

  it('publish-play puts the version in GITHUB_ENV, not only in step outputs', () => {
    const { ia, ib } = order('.github/workflows/publish-play.yml', /PODSHELF_VERSION_NAME=\$PODSHELF_VERSION_NAME" >> "\$GITHUB_ENV"/, /run: npm run generate/)
    expect(ia).toBeLessThan(ib)
  })
})

describe('the phone and watch bundles go to different Play tracks', () => {
  // Play gives the Wear OS form factor dedicated tracks, named by prefixing the mobile one:
  // `internal` for the phone, `wear:internal` for the watch. It checks the manifest against the
  // track in both directions - a phone bundle in a wear: track is rejected for not requiring
  // android.hardware.type.watch, a watch bundle in the phone track for requiring it.
  //
  // Guarded here because the upload action sends every releaseFiles entry to every track it is
  // given, so the obvious one-call version silently does the wrong thing, and finding out costs
  // a full release build.
  const workflow = readFileSync(resolve(__dirname, '../.github/workflows/publish-play.yml'), 'utf8')

  it('sends the watch bundle to its own mapped track', () => {
    expect(workflow).toMatch(/tracks: \$\{\{ steps\.track\.outputs\.wear \}\}/)
  })

  it('never asks for wear:alpha, which does not exist', () => {
    // The first tag failed on exactly this: "Track(s) "wear:alpha" could not be found". Wear's
    // dedicated tracks are not a mirror of the phone's, and this app has no Wear closed
    // testing track, so the watch half of a tag goes to wear:internal.
    // Comments stripped: the workflow quotes the Play error verbatim to explain the mapping,
    // and that quotation is not a request for the track.
    const code = workflow
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n')
    expect(code).not.toMatch(/wear:alpha/)
    expect(code).not.toMatch(/tracks: wear:\$\{\{/)
    expect(workflow).toMatch(/alpha\)\s+wear=wear:internal/)
  })

  it('sends the phone bundle to the unprefixed track', () => {
    expect(workflow).toMatch(/tracks: \$\{\{ steps\.track\.outputs\.name \}\}/)
  })

  it('uploads them separately, rather than both files in one call', () => {
    // Two uploads, each with one retry behind it.
    const uploads = workflow.match(/uses: r0adkll\/upload-google-play/g) ?? []
    expect(uploads.length).toBe(4)
  })

  it('retries an upload rather than failing on an expired edit', () => {
    // Merge-then-tag runs two publishes on the same commit within seconds of each other, and
    // whichever commits its Play edit second finds it "expired". The retry is the remedy Play
    // names, and it only runs when the first attempt failed.
    expect(workflow).toMatch(/id: phone\s+continue-on-error: true/)
    expect(workflow).toMatch(/id: watch\s+continue-on-error: true/)
    expect(workflow).toMatch(/- name: Retry the phone bundle\s+if: steps\.phone\.outcome == 'failure'/)
    expect(workflow).toMatch(/- name: Retry the watch bundle\s+if: steps\.watch\.outcome == 'failure'/)
  })

  it('always sends the watch, with no switch gating it', () => {
    // There was a switch, and the reason for it died when these became two uploads: while both
    // bundles shared a track, a Wear artifact arriving before the form factor existed failed
    // the whole release and took the phone down with it. Separate tracks are separate edits,
    // so there is nothing left to protect, and internal is meant to be master's tip on both
    // devices.
    expect(workflow).not.toMatch(/PUBLISH_WEAR|include_wear|includeWear/)
    const watchStep = workflow.slice(workflow.indexOf('Upload the watch bundle to Play'))
    expect(watchStep.slice(0, 200)).not.toMatch(/^\s*if:/m)
  })
})

describe('the watch bundle declares the feature its track requires', () => {
  const manifest = readFileSync(resolve(__dirname, '../android/wear/src/main/AndroidManifest.xml'), 'utf8')

  it('requires android.hardware.type.watch', () => {
    expect(manifest).toMatch(/android:name="android\.hardware\.type\.watch"[\s\S]{0,80}android:required="true"/)
  })
})

describe('the watch app declares that it needs the phone', () => {
  // Google defines standalone=true as "all of its core functions, such as authentication, work
  // locally on the watch". Nothing authenticates on the watch: WearServerSession is never
  // constructed there, only received from the phone, and without one the UI says "Open Podshelf
  // on your phone to send your queue here".
  //
  // It was declared true. The cost of that is a watch whose paired phone has no Podshelf being
  // offered an app that shows a screen it can never get past.
  const manifest = readFileSync(resolve(__dirname, '../android/wear/src/main/AndroidManifest.xml'), 'utf8')
  const wearSrc = resolve(__dirname, '../android/wear/src/main/java/com/podshelf/wear')

  it('is not declared standalone', () => {
    expect(manifest).toMatch(/com\.google\.android\.wearable\.standalone"[\s\S]{0,60}android:value="false"/)
  })

  it('and that is still true: the watch never builds a session of its own', () => {
    // The assertion behind the flag, so the two cannot drift apart silently. If the watch ever
    // does gain its own sign-in, this fails and points at the manifest.
    const sources = execFileSync('bash', ['-c', `grep -rn 'WearServerSession(' ${wearSrc} || true`], {
      encoding: 'utf8'
    })
    expect(sources.trim()).toBe('')
  })
})

describe('the watch bundle is identifiable in the Play artifact picker', () => {
  // Both modules ship under one applicationId and one Play listing, and both took the version
  // name verbatim. Play lists a bundle by name and code, so picking the Wear artifact by hand
  // meant choosing between two entries that read identically - the only difference being
  // whether the code carried the 1,000,000,000 watch offset.
  const wear = readFileSync(resolve(__dirname, '../android/wear/build.gradle'), 'utf8')
  const phone = readFileSync(resolve(__dirname, '../android/app/build.gradle'), 'utf8')

  it('gives the watch a suffixed version name', () => {
    expect(wear).toMatch(/versionName "\$\{rootProject\.ext\.podshelfVersionName\}-wear"/)
  })

  it('leaves the phone name unsuffixed, so they differ', () => {
    expect(phone).toMatch(/^\s*versionName podshelfVersionName\s*$/m)
    const wearName = /versionName "([^"]*)"/.exec(wear)?.[1]
    expect(wearName).not.toBe('${rootProject.ext.podshelfVersionName}')
  })
})
