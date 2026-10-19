import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  call_span,
  export_traces,
  new_span_id,
  new_trace_id,
  otel_config,
  traces_payload,
  unix_nano
} from '../../src/telemetry/otlp.js'

const row = {
  model: 'm/x',
  actor: 'a-abcdef123456',
  via: 'actor',
  plan: 'free',
  provider: 'DeepInfra',
  client: 'pi/1.0',
  status: 200,
  prompt_tokens: 9,
  completion_tokens: 2,
  cached_tokens: 7,
  cache_write_tokens: 0,
  cost: 0.001,
  request_bytes: 10,
  reply_bytes: 20,
  latency_ms: 412
}

test('ids are the lengths OTLP asks for', () => {
  assert.match(new_trace_id(), /^[a-f0-9]{32}$/)
  assert.match(new_span_id(), /^[a-f0-9]{16}$/)
})

test('a millisecond time becomes an exact nanosecond string', () => {
  assert.equal(unix_nano(1_700_000_000_123), '1700000000123000000')
})

test('a span carries call facts and never the payer phone', () => {
  const span = call_span({
    row: { ...row, payer: '+14155550123' },
    trace: 'a'.repeat(32),
    span: 'b'.repeat(16),
    started: 1000,
    ended: 1412
  })
  const payload = JSON.stringify(traces_payload([span]))
  assert.doesNotMatch(payload, /14155550123|payer/)
  assert.equal(span.kind, 3)
  assert.deepEqual(span.status, { code: 1 })
  assert.equal(span.startTimeUnixNano, '1000000000')
  assert.equal(span.endTimeUnixNano, '1412000000')
  const attrs = Object.fromEntries(
    span.attributes.map(({ key, value }) => [key, Object.values(value)[0]])
  )
  assert.deepEqual(
    [
      attrs['gen_ai.request.model'],
      attrs['gen_ai.provider.name'],
      attrs['gen_ai.usage.cached_tokens'],
      attrs['realness.client'],
      attrs['realness.actor']
    ],
    ['m/x', 'DeepInfra', '7', 'pi/1.0', 'a-abcdef123456']
  )
})

test('a failed call is an error span', () => {
  const span = call_span({
    row: { ...row, status: 429 },
    started: 0,
    ended: 1
  })
  assert.deepEqual(span.status, { code: 2, message: 'status 429' })
})

test('config follows the standard environment variables', () => {
  assert.equal(otel_config({}), null)
  const base = otel_config({
    OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318/',
    OTEL_SERVICE_NAME: 'proxy-a',
    OTEL_EXPORTER_OTLP_HEADERS: 'x-api-key=abc%20123,team=realness'
  })
  assert.deepEqual(base, {
    url: 'http://collector:4318/v1/traces',
    headers: {
      'content-type': 'application/json',
      'x-api-key': 'abc 123',
      team: 'realness'
    },
    service: 'proxy-a',
    timeout_ms: 3000
  })
  assert.equal(
    otel_config({
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://c:4318/v1/traces'
    }).url,
    'http://c:4318/v1/traces'
  )
})

test('export posts the payload and warns instead of throwing', async () => {
  const config = otel_config({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://c:4318' })
  let sent
  const status = await export_traces(
    [call_span({ row, started: 0, ended: 1 })],
    config,
    {
      fetcher: async (url, options) => (
        (sent = { url, options }),
        new Response(null, { status: 200 })
      )
    }
  )
  assert.equal(status, 200)
  assert.equal(sent.url, 'http://c:4318/v1/traces')
  assert.equal(sent.options.headers['content-type'], 'application/json')
  assert.equal(JSON.parse(sent.options.body).resourceSpans.length, 1)
  const warned = []
  assert.equal(
    await export_traces([], config, { warn: message => warned.push(message) }),
    null
  )
  const failed = await export_traces(
    [call_span({ row, started: 0, ended: 1 })],
    config,
    {
      fetcher: async () => {
        throw new Error('down')
      },
      warn: message => warned.push(message)
    }
  )
  assert.equal(failed, null)
  assert.match(warned[0], /otel export failed: down/)
})
