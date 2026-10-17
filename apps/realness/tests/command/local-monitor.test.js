/**
 * The local monitor's frame and its two ways of ending without a live stack.
 *
 * `monitor_local` reads each service through `probe_local`, which is imported,
 * so a frame is only produced for a stack that is actually running. What is
 * covered is everything up to that: the renderer, a service carrying an error,
 * and an already-aborted signal.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { local_frame, monitor_local } from '../../src/command/local-monitor.js'

const sink = () => {
  const chunks = []
  return {
    isTTY: false,
    columns: 80,
    rows: 24,
    write: chunk => {
      chunks.push(String(chunk))
    },
    text: () => chunks.join('')
  }
}

const fake_stdin = () => {
  const asked = []
  return {
    asked,
    isTTY: false,
    setRawMode: on => asked.push(['setRawMode', on]),
    pause: () => asked.push(['pause'])
  }
}

const section = (over = {}) => ({
  name: 'sync',
  state: 'running',
  ownership: 'PID 42',
  lines: ['listen 8080'],
  ...over
})

test('a frame names the stack, the url, and one panel per service', () => {
  const frame = local_frame([section()], { url: 'http://localhost:5173' })
  assert.match(frame, /^REALNESS LOCAL\n/)
  assert.match(frame, /\nhttp:\/\/localhost:5173\n/)
  assert.match(frame, /sync {2}running/)
  assert.match(frame, /PID 42/)
  assert.match(frame, /listen 8080/)
  assert.match(frame, /Ctrl-C\/q stop local children {2}r refresh/)
  assert.match(frame, /The halo and reused services stay running\.\n$/)
})

test('a frame is plain text until colour is asked for', () => {
  const plain = local_frame([section()], { url: 'http://x' })
  assert.doesNotMatch(plain, /\u001b\[/)
  assert.match(
    local_frame([section()], { url: 'http://x', on: true }),
    /\u001b\[32m/
  )
})

test('a frame stops at the height it is given', () => {
  const sections = Array.from({ length: 6 }, (unused, index) =>
    section({ name: `svc${index}` })
  )
  const tall = local_frame(sections, { rows: 30 })
  const short = local_frame(sections, { rows: 6 })

  assert.ok(short.split('\n').length < tall.split('\n').length)
  assert.ok(short.split('\n').length <= 6)
  assert.match(short, /svc0/)
  assert.match(short, /The halo and reused services stay running\./)
})

test('a frame with no services still says what the keys do', () => {
  const frame = local_frame([], { url: 'http://x' })
  assert.match(frame, /REALNESS LOCAL/)
  assert.match(frame, /Ctrl-C\/q stop local children/)
})

test('a service that failed stops the monitor and gives the terminal back', async () => {
  const stdout = sink()
  const stdin = fake_stdin()
  await assert.rejects(
    monitor_local([section({ error: 'port 8080 is taken' })], {
      stdout,
      stdin
    }),
    /port 8080 is taken/
  )
  assert.equal(stdout.text(), '')
  assert.deepEqual(stdin.asked, [['setRawMode', false], ['pause']])
})

test('an aborted signal ends the monitor without drawing', async () => {
  const stdout = sink()
  const stdin = fake_stdin()
  const signal = AbortSignal.abort()
  await monitor_local([section()], { stdout, stdin, signal })
  assert.equal(stdout.text(), '')
  assert.deepEqual(stdin.asked, [['setRawMode', false], ['pause']])
})
