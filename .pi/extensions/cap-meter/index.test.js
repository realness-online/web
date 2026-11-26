import assert from 'node:assert/strict'
import { test } from 'node:test'
import meter, { meter_of } from './index.js'

const run = (model, headers, oauth = true) => {
  const marks = []
  let handler
  meter(
    /** @type {any} */ ({ on: (_name, h) => (handler = h), appendEntry: (type, data) => marks.push({ type, data }) })
  )
  handler({ status: 200, headers }, { model, modelRegistry: { isUsingOAuth: () => oauth } })
  return marks
}

const HEADERS = {
  'anthropic-ratelimit-unified-7d-utilization': '0.42',
  'anthropic-ratelimit-unified-7d-reset': '1795000000'
}

test('the weekly meter is read from the headers', () => {
  assert.deepEqual(meter_of(HEADERS), { used: 0.42, reset: 1795000000 })
  assert.equal(meter_of({}), null)
})

test('a Claude reply marks the session with the meter and the billing', () => {
  const [mark] = run({ provider: 'anthropic' }, HEADERS)
  assert.equal(mark.type, 'cap-meter')
  assert.equal(mark.data.billing, 'sub')
  assert.equal(mark.data.used, 0.42)
})

test('a paid Claude call is marked credits; other providers are not marked', () => {
  assert.equal(run({ provider: 'anthropic' }, {}, false)[0].data.billing, 'credits')
  assert.equal(run({ provider: 'deepseek' }, HEADERS).length, 0)
})

test('a subscription reply without the meter leaves no mark', () => {
  assert.equal(run({ provider: 'anthropic' }, {}).length, 0)
})
