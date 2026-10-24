import { it } from 'node:test'
import assert from 'node:assert/strict'
import {
  execution_interval,
  workload_overlap
} from '#root/src/control/capacity-evidence.js'
import { check_capacity_result } from '#root/src/control/capacity-result.js'
import { workload_timeout } from '#root/src/control/capacity-workloads.js'

const result = events => ({
  exit_code: 0,
  stdout_b64: Buffer.from(
    events.map(event => JSON.stringify(event)).join('\n')
  ).toString('base64')
})
const evidence = {
  type: 'capacity_workload',
  kind: 'memory',
  elapsed_ms: 8,
  guest_peak_mib: 300,
  memory_source: 'proc-meminfo'
}

it('guest duration bounds execution inside the enclosing request without synchronized clocks', () => {
  assert.deepEqual(execution_interval(0, 10, 8), [10 - 8 * 0.99, 8 * 0.99])
  assert.equal(execution_interval(0, 10, 4), null)
  for (const duration of [0, -1, NaN, Infinity, 11])
    assert.throws(
      () => execution_interval(0, 10, duration),
      /guest workload duration/
    )
})

it('guest overlap counts distinct workload types and excludes touching endpoints', () => {
  assert.equal(
    workload_overlap([
      { name: 'cpu', interval: [1, 5] },
      { name: 'cpu', interval: [2, 4] },
      { name: 'memory', interval: [3, 6] },
      { name: 'browser', interval: [6, 8] },
      { name: 'pi', interval: null }
    ]),
    2
  )
  assert.equal(
    workload_overlap([
      { name: 'cpu', interval: [1, 3] },
      { name: 'pi', interval: [3, 5] }
    ]),
    1
  )
})

it('guest evidence requires measured Linux memory, matching workload and finite duration', () => {
  const workload = { name: 'memory', guest_evidence: true }
  assert.deepEqual(
    check_capacity_result(workload, result([evidence])),
    evidence
  )
  for (const change of [
    { kind: 'cpu' },
    { elapsed_ms: null },
    { elapsed_ms: -1 },
    { guest_peak_mib: null },
    { memory_source: 'os-freemem' }
  ])
    assert.throws(
      () =>
        check_capacity_result(workload, result([{ ...evidence, ...change }])),
      /evidence/
    )
  assert.throws(() => check_capacity_result(workload, result([])), /evidence/)
})

it('browser evidence requires both an opened page and a released lease', () => {
  const workload = { name: 'browser', guest_evidence: true }
  const browser = {
    ...evidence,
    kind: 'browser',
    browser_verified: true,
    browser_released: true
  }
  assert.equal(
    check_capacity_result(workload, result([browser])).browser_released,
    true
  )
  for (const field of ['browser_verified', 'browser_released'])
    assert.throws(
      () =>
        check_capacity_result(
          workload,
          result([{ ...browser, [field]: false }])
        ),
      /lease release/
    )
})

it('Pi evidence must also contain a settled expected assistant reply', () => {
  const workload = { name: 'pi', guest_evidence: true, pi_reply: 'ready' }
  const pi = { ...evidence, kind: 'pi' }
  const reply = {
    type: 'message_end',
    message: {
      role: 'assistant',
      stopReason: 'stop',
      content: [{ type: 'text', text: 'ready' }]
    }
  }
  assert.throws(
    () => check_capacity_result(workload, result([pi, reply])),
    /did not settle/
  )
  assert.equal(
    check_capacity_result(
      workload,
      result([reply, { type: 'agent_settled' }, pi])
    ).kind,
    'pi'
  )
})

it('memory stages and capacity workloads share the same guest timeout range', () => {
  assert.equal(workload_timeout({}), 120)
  assert.equal(workload_timeout({ timeout_s: 150 }), 150)
  for (const timeout_s of [0, -1, NaN, Infinity, 1801])
    assert.throws(() => workload_timeout({ timeout_s }), /workload timeout/)
})
