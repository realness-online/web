/**
 * The halo's own helpers. `run` is exercised with node itself rather than a
 * Linux tool, so the exit-code handling is checked without depending on
 * `mountpoint`, `ip`, or a VM.
 *
 * Nothing here mounts, taps, or needs root: `ensure_tap` takes its three
 * commands, and the TAP address helpers are arithmetic.
 */
import { it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ensure_tap,
  free_tap,
  LAST_TAP,
  require_root,
  run,
  short_enough_for_unix,
  tap_guest
} from '../../src/halo/syscalls.js'

it('run returns the joined output and the exit code', () => {
  const { code, output } = run([
    'node',
    '-e',
    'process.stdout.write("out"); process.stderr.write("err")'
  ])
  assert.equal(code, 0)
  assert.equal(output, 'outerr')
})

it('run throws a HaloError naming the whole command and the exit', () => {
  assert.throws(
    () => run(['node', '-e', 'process.exit(3)']),
    error => {
      assert.match(error.message, /exit 3/)
      assert.match(error.message, /node -e process\.exit\(3\)/)
      return true
    }
  )
})

it('run can be asked not to throw, and reports a missing command as 127', () => {
  assert.equal(run(['node', '-e', 'process.exit(9)'], { check: false }).code, 9)
  const missing = run(['definitely-not-a-real-command-xyz'], { check: false })
  assert.equal(missing.code, 127)
})

it('run passes its input through to the command', () => {
  const { output } = run(['node', '-e', 'process.stdin.pipe(process.stdout)'], {
    input: 'piped through'
  })
  assert.equal(output, 'piped through')
})

it('require_root passes for root and refuses anyone else', t => {
  t.mock.method(process, 'geteuid', () => 0)
  assert.doesNotThrow(() => require_root('mounting'))

  t.mock.method(process, 'geteuid', () => 1000)
  assert.throws(
    () => require_root('mounting'),
    /mounting needs root: re-run with sudo/
  )
})

it('a unix path must stay under 108 bytes', () => {
  assert.equal(short_enough_for_unix('/run/actor.sock'), true)
  assert.equal(short_enough_for_unix(`/run/${'a'.repeat(103)}.sock`), false)
})

it('the guest address follows the TAP index', () => {
  assert.equal(tap_guest('tap3'), '172.16.3.2')
  assert.equal(tap_guest('fc-tap12'), '172.16.12.2')
  assert.equal(tap_guest('tap7', '10.0'), '10.0.7.2')
  assert.throws(() => tap_guest('tap'), /no index in TAP name tap/)
})

it('free_tap refuses an empty range', () => {
  assert.throws(() => free_tap('tap', 5, 1), /no free TAP in tap5\.\.1/)
})

it('ensure_tap leaves an already ready TAP alone', () => {
  const used = []
  const rebuilt = ensure_tap('tap1', {
    ready: () => true,
    remove: name => used.push(['remove', name]),
    create: name => used.push(['create', name])
  })
  assert.equal(rebuilt, false)
  assert.deepEqual(used, [])
})

it('ensure_tap rebuilds a TAP that is down, missing its gateway, or gone', () => {
  const used = []
  const rebuilt = ensure_tap('tap2', {
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

it('the last actor TAP still has its own /30 inside 172.16.0.0/16', () => {
  assert.ok(LAST_TAP >= 200, 'hs-tap: a halo can address 200 actors')
  assert.ok(LAST_TAP <= 254)
  assert.equal(tap_guest(`fc-tap${LAST_TAP}`), `172.16.${LAST_TAP}.2`)
})
