import { randomBytes as random_bytes } from 'node:crypto'

export const SERVICE = 'realness-proxy'
const SCOPE = 'realness.proxy'
const TIMEOUT_MS = 3000
const NANOS = 1_000_000n
const TRACE_BYTES = 16
const SPAN_BYTES = 8
const OK_MIN = 200
const OK_MAX = 400

/** OTLP asks for 16-byte trace ids and 8-byte span ids, hex encoded. */
export const new_trace_id = () => random_bytes(TRACE_BYTES).toString('hex')
export const new_span_id = () => random_bytes(SPAN_BYTES).toString('hex')

/** OTLP int64 fields are decimal strings; a millisecond time is nanoseconds. */
export const unix_nano = ms => (BigInt(Math.round(ms)) * NANOS).toString()

const int = (key, value) => ({
  key,
  value: { intValue: String(value ?? 0) }
})
const double = (key, value) => ({ key, value: { doubleValue: value ?? 0 } })
const text = (key, value) => ({
  key,
  value: { stringValue: String(value ?? '') }
})

/**
 * One client span for a model call. `row` is a ledger row; `payer` stays out
 * because a phone number must not leave for a third-party trace store.
 */
export const call_span = ({
  row,
  trace = new_trace_id(),
  span = new_span_id(),
  started,
  ended = Date.now(),
  upstream = 'https://openrouter.ai/api/v1/chat/completions'
}) => {
  const error = row.status < OK_MIN || row.status >= OK_MAX
  return {
    traceId: trace,
    spanId: span,
    name: 'model.call',
    kind: 3,
    startTimeUnixNano: unix_nano(started),
    endTimeUnixNano: unix_nano(ended),
    attributes: [
      text('url.full', upstream),
      text('gen_ai.operation.name', 'chat'),
      text('gen_ai.request.model', row.model),
      text('gen_ai.provider.name', row.provider || 'unknown'),
      text('realness.actor', row.actor),
      text('realness.via', row.via ?? ''),
      text('realness.plan', row.plan ?? ''),
      text('realness.client', row.client || 'unknown'),
      int('http.response.status_code', row.status),
      int('gen_ai.usage.input_tokens', row.prompt_tokens),
      int('gen_ai.usage.output_tokens', row.completion_tokens),
      int('gen_ai.usage.cached_tokens', row.cached_tokens),
      int('gen_ai.usage.cache_write_tokens', row.cache_write_tokens),
      double('gen_ai.usage.cost', row.cost),
      int('realness.request_bytes', row.request_bytes),
      int('realness.reply_bytes', row.reply_bytes),
      int('realness.latency_ms', row.latency_ms)
    ],
    status: error ? { code: 2, message: `status ${row.status}` } : { code: 1 }
  }
}

/** A resourceSpans payload carrying the spans for one service. */
export const traces_payload = (spans, service = SERVICE) => ({
  resourceSpans: [
    {
      resource: { attributes: [text('service.name', service)] },
      scopeSpans: [{ scope: { name: SCOPE }, spans }]
    }
  ]
})

const headers_of = value =>
  Object.fromEntries(
    String(value ?? '')
      .split(',')
      .map(pair => pair.trim())
      .filter(Boolean)
      .map(pair => {
        const at = pair.indexOf('=')
        return [
          pair.slice(0, at).trim(),
          decodeURIComponent(pair.slice(at + 1).trim())
        ]
      })
  )

/**
 * OTLP export settings from the standard environment variables. Null means
 * no collector is configured, so spans are not exported.
 * @param {Record<string, string | undefined>} [env]
 */
export const otel_config = (env = process.env) => {
  const base =
    env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? env.OTEL_EXPORTER_OTLP_ENDPOINT
  if (!base) return null
  return {
    url: base.endsWith('/v1/traces')
      ? base
      : `${base.replace(/\/$/, '')}/v1/traces`,
    headers: {
      'content-type': 'application/json',
      ...headers_of(env.OTEL_EXPORTER_OTLP_HEADERS)
    },
    service: env.OTEL_SERVICE_NAME || SERVICE,
    timeout_ms: Number(env.OTEL_EXPORTER_TIMEOUT_MS) || TIMEOUT_MS
  }
}

/**
 * Send spans to the collector. Telemetry must never fail a model call, so a
 * refusal is warned about and returned, not thrown.
 */
export const export_traces = async (
  spans,
  config,
  { fetcher = fetch, warn = console.error } = {}
) => {
  if (!config || !spans.length) return null
  try {
    const reply = await fetcher(config.url, {
      method: 'POST',
      headers: config.headers,
      body: JSON.stringify(traces_payload(spans, config.service)),
      signal: AbortSignal.timeout(config.timeout_ms)
    })
    if (!reply.ok) throw new Error(`collector answered ${reply.status}`)
    return reply.status
  } catch (error) {
    warn(`otel export failed: ${error.message}`)
    return null
  }
}
