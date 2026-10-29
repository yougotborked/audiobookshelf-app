import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
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
