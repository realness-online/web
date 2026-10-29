import { it } from 'node:test'
import assert from 'node:assert/strict'
import {
  describe_icloud_status,
  parse_icloud_status,
  wait_for_icloud
} from '../../src/control/icloud.js'

const container = ({ ready = false, color = false } = {}) => {
  const green = color ? '\x1b[0;1;32m' : ''
  const reset = color ? '\x1b[0m' : ''
  return `<c{1}m.a{3}e.C{7}s[1] ${green}foreground${reset} {client:idle sync:${ready ? 'caught-up' : 'uploading'} token:<private>}>`
}

const output = (...lines) =>
  [
    "2 containers matching '*'",
    ...lines,
    'Desktop & Documents: current=NO lastEnabled=(never) lastDisabled=(never)'
  ].join('\n')

it('reads caught-up containers without exposing their tokens', () => {
  const status = parse_icloud_status(
    output(container({ ready: true, color: true }), container({ ready: true }))
  )
  assert.deepEqual(status, {
    containers: 2,
    caught: 2,
    pending_items: 0,
    ready: true
  })
  assert.doesNotMatch(describe_icloud_status(status), /private|token/i)
})

it('a container still uploading is not ready', () => {
  const status = parse_icloud_status(
    output(container({ ready: true }), container())
  )
  assert.equal(status.caught, 1)
  assert.equal(status.ready, false)
  assert.match(describe_icloud_status(status), /1 of 2/)
})

it('any pending item line blocks readiness', () => {
  const status = parse_icloud_status(
    output(
      container({ ready: true }),
      container({ ready: true }),
      'vault/Projects/realness.md pending upload'
    )
  )
  assert.equal(status.pending_items, 1)
  assert.equal(status.ready, false)
  assert.match(describe_icloud_status(status), /1 pending items/)
})

it('no containers is not ready', () => {
  const status = parse_icloud_status("0 containers matching '*'")
  assert.equal(status.ready, false)
  assert.equal(describe_icloud_status(status), 'iCloud: no containers found')
})

it('wait reports each change and stops when caught up', async () => {
  const states = [
    parse_icloud_status(output(container({ ready: true }), container())),
    parse_icloud_status(
      output(container({ ready: true }), container({ ready: true }))
    )
  ]
  let next = 0
  const seen = []
  const status = await wait_for_icloud({
    read: async () => states[next++],
    on_status: value => seen.push(value.ready),
    sleep: async () => {},
    now: () => 0
  })
  assert.equal(status.ready, true)
  assert.equal(status.timed_out, false)
  assert.deepEqual(seen, [false, true])
})
