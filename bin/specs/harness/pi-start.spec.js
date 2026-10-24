import assert from 'node:assert/strict'
import { it } from 'node:test'
import { copyFileSync as copy_file_sync, mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, readFileSync as read_file_sync, rmSync as rm_sync, symlinkSync as symlink_sync, utimesSync as utimes_sync, writeFileSync as write_file_sync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync as spawn_sync } from 'node:child_process'

const scratch = resolve(import.meta.dirname, '../../../artifacts/realness/start-tests')
const fixture = () => {
  mkdir_sync(scratch, { recursive: true })
  const root = mkdtemp_sync(join(scratch, 'checkout with spaces-'))
  const home = join(root, 'user-home')
  const binaries = join(root, 'test-bin')
  const pinned = join(root, '.pi/runtime/node_modules/.bin')
  mkdir_sync(join(root, 'bin/harness'), { recursive: true })
  mkdir_sync(binaries)
  symlink_sync(process.execPath, join(binaries, 'node'))
  mkdir_sync(join(home, '.pi/agent'), { recursive: true })
  write_file_sync(join(home, '.pi/agent/auth.json'), 'Existing private user state\n')
  copy_file_sync(join(import.meta.dirname, '../../pi'), join(root, 'bin/pi'))
  write_file_sync(join(root, 'bin/harness/session-location.js'), 'process.stdout.write(process.argv[2] + "/vault/Sessions")\n')
  const env = { HOME: home, PATH: `${binaries}:${dirname(process.execPath)}:/usr/bin:/bin` }
  const executable = (name, body) => write_file_sync(join(binaries, name), `#!/bin/bash\n${body}\n`, { mode: 0o755 })
  const install = () => {
    mkdir_sync(pinned, { recursive: true })
    write_file_sync(join(pinned, 'pi'), '#!/bin/bash\nprintf "%s\\n" "$PI_CODING_AGENT_DIR" "$PI_CODING_AGENT_SESSION_DIR" "$PI_SESSION_FORMAT" "$PI_SESSION_READER" "$1"\n', { mode: 0o755 })
    write_file_sync(join(pinned, 'pi-session-read'), '#!/bin/bash\nexit 0\n', { mode: 0o755 })
  }
  const run = (...args) => spawn_sync('/bin/bash', [join(root, 'bin/pi'), ...args, '--version'], { env, encoding: 'utf8', timeout: 10_000 })
  const cleanup = () => rm_sync(root, { recursive: true, force: true })
  return { root, home, env, pinned, executable, install, run, cleanup }
}

it('the public harness name is Realness and the old launch command remains an alias', () => {
  const manifest = JSON.parse(read_file_sync(resolve(import.meta.dirname, '../../../package.json'), 'utf8'))
  assert.equal(manifest.name, 'realness')
  assert.equal(manifest.scripts.realness, manifest.scripts.start)
  assert.equal(manifest.scripts.realness, manifest.scripts.realness)
})

it('startup uses the checkout fork and leaves an existing global Pi home alone', () => {
  const f = fixture()
  try {
    f.install()
    f.executable('pi', 'printf "wrong global Pi\\n"')
    const result = f.run()
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, `${f.root}/.pi/agent\n${f.root}/vault/Sessions\nhtml.gz\n${f.pinned}/pi-session-read\n--version\n`)
    assert.equal(read_file_sync(join(f.home, '.pi/agent/auth.json'), 'utf8'), 'Existing private user state\n')
  } finally { f.cleanup() }
})

it('missing runtime fails rather than borrowing global Pi or downloading upstream', () => {
  const f = fixture()
  try {
    f.executable('pi', 'printf "wrong global Pi\\n"')
    f.executable('npx', 'printf "unexpected download\\n"')
    const result = f.run()
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Pinned Pi is missing.*npm install/)
    assert.equal(result.stdout, '')
  } finally { f.cleanup() }
})

it('a partial install without the decoder fails before opening a session', () => {
  const f = fixture()
  try {
    f.install()
    rm_sync(join(f.pinned, 'pi-session-read'))
    const result = f.run()
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Pinned Pi is missing/)
    assert.equal(result.stdout, '')
  } finally { f.cleanup() }
})

it('hosted actors retain their preinstalled command without downloading upstream', () => {
  const f = fixture()
  try {
    f.executable('pi', 'printf "actor:%s\\n" "$1"')
    assert.equal(f.run('--actor').stdout, 'actor:--version\n')
  } finally { f.cleanup() }
})

it('an actor resumes a session used in the last 13 minutes; older or none starts fresh', () => {
  const f = fixture()
  try {
    f.install()
    const start = (...args) => spawn_sync('/bin/bash', [join(f.root, 'bin/pi'), ...args], { env: f.env, encoding: 'utf8', timeout: 10_000 })
    const first_arg = result => result.stdout.split('\n')[4]
    const sessions = join(f.root, 'vault/Sessions')
    assert.equal(first_arg(start('--actor')), '')
    mkdir_sync(sessions, { recursive: true })
    const session = join(sessions, 'last.html.gz')
    write_file_sync(session, '')
    assert.equal(first_arg(start('--actor')), '--continue')
    assert.equal(first_arg(start('--actor', '--version')), '--version')
    assert.equal(first_arg(start()), '')
    const old = new Date(Date.now() - 14 * 60_000)
    utimes_sync(session, old, old)
    assert.equal(first_arg(start('--actor')), '')
  } finally { f.cleanup() }
})

it('an actor resumes within the length of a thought', async () => {
  const { THOUGHT_WINDOW_MS } = await import('../../../apps/realness/packages/thoughts/src/thoughts.js')
  const minutes = read_file_sync(join(import.meta.dirname, '../../pi'), 'utf8').match(/^thought_minutes=(\d+)$/m)[1]
  assert.equal(Number(minutes) * 60_000, THOUGHT_WINDOW_MS)
})

it('Pi keeps scratch output inside the harness', () => {
  const f = fixture()
  try {
    mkdir_sync(f.pinned, { recursive: true })
    write_file_sync(join(f.pinned, 'pi'), '#!/bin/bash\nprintf "%s\\n" "$TMPDIR"\n', { mode: 0o755 })
    write_file_sync(join(f.pinned, 'pi-session-read'), '#!/bin/bash\nexit 0\n', { mode: 0o755 })
    const result = f.run()
    assert.equal(result.stdout, `${f.root}/artifacts/pi\n`)
  } finally { f.cleanup() }
})

it('an actor runs the installed fork with compressed sessions, like a person', () => {
  const f = fixture()
  try {
    f.executable('pi', 'printf "%s\\n" "$PI_SESSION_FORMAT" "$PI_SESSION_READER"')
    f.executable('pi-session-read', 'exit 0')
    const result = f.run('--actor')
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, `html.gz\n${join(f.root, 'test-bin')}/pi-session-read\n`)
  } finally { f.cleanup() }
})
