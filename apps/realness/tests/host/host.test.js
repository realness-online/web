/**
 * The host's own helpers. `run` is exercised with node itself rather than a
 * Linux tool, so the exit-code handling is checked without depending on
 * `mountpoint`, `ip`, or a VM.
 *
 * Nothing here mounts, taps, or needs root: `ensureTap` takes its three
 * commands, and the TAP address helpers are arithmetic.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ensureTap,
  freeTap,
  requireRoot,
  run,
  shortEnoughForUnix,
  tapGuest
} from '../../src/host/host.js'

test('run returns the joined output and the exit code', () => {
  const { code, output } = run([
    'node',
    '-e',
    'process.stdout.write("out"); process.stderr.write("err")'
  ])
  assert.equal(code, 0)
  assert.equal(output, 'outerr')
})

test('run throws a HostError naming the whole command and the exit', () => {
  assert.throws(
    () => run(['node', '-e', 'process.exit(3)']),
    error => {
      assert.match(error.message, /exit 3/)
      assert.match(error.message, /node -e process\.exit\(3\)/)
      return true
    }
  )
})

test('run can be asked not to throw, and reports a missing command as 127', () => {
  assert.equal(run(['node', '-e', 'process.exit(9)'], { check: false }).code, 9)
  const missing = run(['definitely-not-a-real-command-xyz'], { check: false })
  assert.equal(missing.code, 127)
})

test('run passes its input through to the command', () => {
  const { output } = run(['node', '-e', 'process.stdin.pipe(process.stdout)'], {
    input: 'piped through'
  })
  assert.equal(output, 'piped through')
})

test('requireRoot passes for root and refuses anyone else', t => {
  t.mock.method(process, 'geteuid', () => 0)
  assert.doesNotThrow(() => requireRoot('mounting'))

  t.mock.method(process, 'geteuid', () => 1000)
  assert.throws(
    () => requireRoot('mounting'),
    /mounting needs root: re-run with sudo/
  )
})

test('a unix path must stay under 108 bytes', () => {
  assert.equal(shortEnoughForUnix('/run/actor.sock'), true)
  assert.equal(shortEnoughForUnix(`/run/${'a'.repeat(103)}.sock`), false)
})

test('the guest address follows the TAP index', () => {
  assert.equal(tapGuest('tap3'), '172.16.3.2')
  assert.equal(tapGuest('fc-tap12'), '172.16.12.2')
  assert.equal(tapGuest('tap7', '10.0'), '10.0.7.2')
  assert.throws(() => tapGuest('tap'), /no index in TAP name tap/)
})

test('freeTap refuses an empty range', () => {
  assert.throws(() => freeTap('tap', 5, 1), /no free TAP in tap5\.\.1/)
})

test('ensureTap leaves an already ready TAP alone', () => {
  const used = []
  const rebuilt = ensureTap('tap1', {
    ready: () => true,
    remove: name => used.push(['remove', name]),
    create: name => used.push(['create', name])
  })
  assert.equal(rebuilt, false)
  assert.deepEqual(used, [])
})

test('ensureTap rebuilds a TAP that is down, missing its gateway, or gone', () => {
  const used = []
  const rebuilt = ensureTap('tap2', {
    ready: () => false,
    remove: name => used.push(['remove', name]),
    create: name => used.push(['create', name])
  })
  assert.equal(rebuilt, true)
  assert.deepEqual(used, [
    ['remove', 'tap2'],
    ['create', 'tap2']
  ])
})
