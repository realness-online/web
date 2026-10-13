import assert from 'node:assert/strict'
import { test } from 'node:test'
import { copyFileSync as copy_file_sync, mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, readFileSync as read_file_sync, rmSync as rm_sync, symlinkSync as symlink_sync, writeFileSync as write_file_sync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync as spawn_sync } from 'node:child_process'

const scratch = resolve(import.meta.dirname, '../artifacts/realness/start-tests')
const fixture = () => {
  mkdir_sync(scratch, { recursive: true })
  const root = mkdtemp_sync(join(scratch, 'checkout with spaces-'))
  const home = join(root, 'user-home')
  const binaries = join(root, 'test-bin')
  const pinned = join(root, '.pi/runtime/node_modules/.bin')
  mkdir_sync(join(root, 'bin'))
  mkdir_sync(binaries)
  symlink_sync(process.execPath, join(binaries, 'node'))
  mkdir_sync(join(home, '.pi/agent'), { recursive: true })
  write_file_sync(join(home, '.pi/agent/auth.json'), 'Existing private user state\n')
  copy_file_sync(join(import.meta.dirname, 'pi'), join(root, 'bin/pi'))
  write_file_sync(join(root, 'bin/session-location.js'), 'process.stdout.write(process.argv[2] + "/vault/Sessions")\n')
  const env = { HOME: home, PATH: `${binaries}:${dirname(process.execPath)}:/usr/bin:/bin` }
  const executable = (name, body) => write_file_sync(join(binaries, name), `#!/bin/bash\n${body}\n`, { mode: 0o755 })
  const install = () => {
    mkdir_sync(pinned, { recursive: true })
    write_file_sync(join(pinned, 'pi'), '#!/bin/bash\nprintf "%s\\n" "$PI_CODING_AGENT_DIR" "$PI_CODING_AGENT_SESSION_DIR" "$PI_SESSION_FORMAT" "$PI_SESSION_READER" "$1"\n', { mode: 0o755 })
    write_file_sync(join(pinned, 'pi-session-read'), '#!/bin/bash\nexit 0\n', { mode: 0o755 })
  }
  const run = () => spawn_sync('/bin/bash', [join(root, 'bin/pi'), '--version'], { env, encoding: 'utf8', timeout: 10_000 })
  const cleanup = () => rm_sync(root, { recursive: true, force: true })
  return { root, home, env, pinned, executable, install, run, cleanup }
}

test('the public harness name is Realness and the old launch command remains an alias', () => {
  const manifest = JSON.parse(read_file_sync(resolve(import.meta.dirname, '../package.json'), 'utf8'))
  assert.equal(manifest.name, 'realness')
  assert.equal(manifest.scripts.realness, manifest.scripts.start)
  assert.equal(manifest.scripts.brayness, manifest.scripts.realness)
})

test('startup uses the checkout fork and leaves an existing global Pi home alone', () => {
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

test('missing runtime fails rather than borrowing global Pi or downloading upstream', () => {
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

test('a partial install without the decoder fails before opening a session', () => {
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

test('hosted actors retain their preinstalled command without downloading upstream', () => {
  const f = fixture()
  try {
    f.env.BRAYNESS_ACTOR = '1'
    f.executable('pi', 'printf "actor:%s\\n" "$1"')
    assert.equal(f.run().stdout, 'actor:--version\n')
  } finally { f.cleanup() }
})
