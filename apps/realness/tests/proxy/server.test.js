import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { existsSync } from 'node:fs'
import { QUOTA_MESSAGES, agent_service } from '../../src/proxy/server.js'
import { issue_model_pass } from '../../src/proxy/model-pass.js'

const secret = 'model-pass-server-test-secret-at-least-thirty-two-bytes'
let server, url, calls, rows
const settle = () => new Promise(resolve => setTimeout(resolve, 10))
before(async () => {
  calls = []
  rows = []
  server = agent_service({
    identify_phone: async token =>
      token === 'phone.token.signature' ? { phone: '+14155550123' } : null,
    secret,
    key: 'test-key',
    ledger: { record: async (phone, row) => rows.push({ phone, ...row }) },
    fetcher: async (_url, options) => {
      calls.push(options)
      return new Response('data: done\n', {
        headers: { 'content-type': 'text/event-stream' }
      })
    }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${server.address().port}`
})
after(() => new Promise(resolve => server.close(resolve)))

test('a stranger cannot spend upstream calls', async () => {
  const result = await fetch(url, {
    method: 'POST',
    headers: { authorization: 'Bearer shared-pass' },
    body: '{}'
  })
  assert.equal(result.status, 401)
  assert.equal(calls.length, 0)
})

test('an identified person receives the streamed reply', async () => {
  const result = await fetch(url, {
    method: 'POST',
    headers: { authorization: 'Bearer phone.token.signature' },
    body: JSON.stringify({ messages: [] })
  })
  assert.equal(result.status, 200)
  assert.equal(result.headers.get('content-type'), 'text/event-stream')
  assert.equal(await result.text(), 'data: done\n')
  assert.equal(calls.length, 1)
  assert.deepEqual(JSON.parse(calls[0].body).usage, { include: true })
  await settle()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].phone, '+14155550123')
  assert.equal(rows[0].actor, 'phone')
  assert.equal(rows[0].payer, '+14155550123')
  assert.equal(rows[0].reply_bytes, 11)
  assert.equal(rows[0].request_bytes, 15)
})

test('actor pass works; forged passes do not', async () => {
  const actor = { phone: '+14155550123', id: 'a-abcdef123456' }
  const pass = issue_model_pass(actor, secret)
  const result = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${pass}` },
    body: '{}'
  })
  assert.equal(result.status, 200)
  assert.equal(calls.length, 2)
  const [body, signature] = pass.split('.')
  const rejected = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${body}.${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`
    },
    body: '{}'
  })
  assert.equal(rejected.status, 401)
  assert.equal(calls.length, 2)
  await settle()
  assert.equal(rows.length, 2)
  assert.equal(rows[1].actor, 'a-abcdef123456')
  assert.equal(rows[1].payer, '+14155550123')
})

test("b1a: an app's pass bills the app's owner", async () => {
  const pass = issue_model_pass(
    { phone: '+14155550199', id: 'app-abcdef123456' },
    secret
  )
  const result = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${pass}` },
    body: '{}'
  })
  assert.equal(result.status, 200)
  await settle()
  const row = rows.at(-1)
  assert.deepEqual(
    [row.phone, row.payer, row.actor],
    ['+14155550199', '+14155550199', 'app-abcdef123456']
  )
})

test('quota: over is 429, unreadable is 503, neither calls upstream', async () => {
  const start = async spent => {
    const quota_server = agent_service({
      identify_phone: async () => ({ phone: '+14155550123' }),
      secret,
      key: 'test-key',
      plan_for: async () => ({
        free: { day: { tokens: 100 }, month: { tokens: 1000 } },
        paid: null
      }),
      warn: () => {},
      ledger: { spent, record: async () => {} },
      fetcher: async (_url, options) => (
        calls.push(options),
        new Response('ok')
      )
    })
    await new Promise(resolve => quota_server.listen(0, '127.0.0.1', resolve))
    const reply = await fetch(
      `http://127.0.0.1:${quota_server.address().port}`,
      {
        method: 'POST',
        headers: { authorization: 'Bearer phone.token.signature' },
        body: '{}'
      }
    )
    await new Promise(resolve => quota_server.close(resolve))
    return reply.status === 429
      ? (await reply.json()).error.limit
      : reply.status
  }
  const at = (day, month) => async () => ({
    day: { tokens: day, cost: 0 },
    month: { tokens: month, cost: 0 }
  })
  const before = calls.length
  assert.equal(await start(at(100, 100)), 'day')
  assert.equal(await start(at(0, 1000)), 'month')
  assert.equal(
    await start(async () => {
      throw new Error('down')
    }),
    503
  )
  assert.equal(calls.length, before)
  assert.equal(await start(at(99, 999)), 200)
})

const pi_retry = new URL(
  '../../../../.pi/agent/npm/node_modules/@earendil-works/pi-ai/dist/utils/retry.js',
  import.meta.url
)
test(
  'Pi does not retry the quota refusal',
  { skip: !existsSync(pi_retry) && 'no local pi-ai' },
  async () => {
    const { isRetryableAssistantError } = await import(pi_retry)
    for (const message of Object.values(QUOTA_MESSAGES))
      assert.equal(
        isRetryableAssistantError({
          stopReason: 'error',
          errorMessage: `429 ${message}`
        }),
        false
      )
    assert.equal(
      isRetryableAssistantError({
        stopReason: 'error',
        errorMessage: '429 Too many requests'
      }),
      true
    )
  }
)

import { createHmac } from 'node:crypto'
import { createServer } from 'node:http'
import {
  agent_handler,
  checkout_handler,
  limit_handler,
  proxy_handler,
  wants_house,
  webhook_handler
} from '../../src/proxy/server.js'
import { HOUSE_MODEL, MODEL } from '../../src/proxy/agent.js'

const paid_plan = {
  status: 'active',
  credit: 5,
  start: '2026-10-01',
  end: '2999-01-01T00:00:00.000Z',
  subscription: 'sub_1'
}
async function routed({ paid = null, cost = 0, stripe = null }) {
  const sent = [],
    recorded = [],
    put = []
  const identify_phone = async () => ({ phone: '+14155550123' })
  const ledger = {
    spent: async () => ({
      day: { tokens: 10, cost: 0 },
      month: { tokens: 10, cost: 0 }
    }),
    spent_since: async () => ({ tokens: 0, cost }),
    record: async (phone, row) => recorded.push(row)
  }
  const plan_for = async () => ({
    free: { day: { tokens: 100 }, month: { tokens: 1000 } },
    paid
  })
  const billing = {
    get: async () => paid,
    put: async (phone, plan) => put.push({ phone, ...plan })
  }
  const handler = proxy_handler({
    agent: agent_handler({
      identify_phone,
      secret,
      key: 'k',
      ledger,
      plan_for,
      warn: () => {},
      fetcher: async (_u, o) => (
        sent.push(JSON.parse(o.body)),
        new Response('{}')
      )
    }),
    limit: limit_handler({ identify_phone, secret, ledger, plan_for }),
    pay: checkout_handler({ identify_phone, secret, stripe, price: 'price_1' }),
    webhook: webhook_handler({
      stripe,
      billing,
      webhook_secret: 'whsec_t',
      log: () => {},
      warn: () => {}
    }),
    origins: ['https://realness-development.web.app']
  })
  const server = createServer(handler)
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const at = `http://127.0.0.1:${server.address().port}`
  const auth = { authorization: 'Bearer phone.token.signature' }
  return {
    at,
    auth,
    sent,
    recorded,
    put,
    close: () => new Promise(done => server.close(done))
  }
}

test('b1d: the house model is asked for by name', () => {
  assert.equal(wants_house({ model: 'house' }), true)
  assert.equal(wants_house({ model: 'brayness/deepseek' }), true)
  assert.equal(wants_house({ model: 'inkling' }), false)
  assert.equal(wants_house({}), false)
})

test('b1d: free people get the free model; the house model needs a plan', async () => {
  const s = await routed({})
  const free = await fetch(`${s.at}/chat/completions`, {
    method: 'POST',
    headers: s.auth,
    body: JSON.stringify({ model: 'inkling' })
  })
  assert.equal(free.status, 200)
  const house = await fetch(`${s.at}/chat/completions`, {
    method: 'POST',
    headers: s.auth,
    body: JSON.stringify({ model: 'house' })
  })
  assert.equal(house.status, 429)
  assert.equal((await house.json()).error.limit, 'plan')
  await settle()
  assert.deepEqual(
    [s.sent.length, s.sent[0].model, s.recorded[0].plan],
    [1, MODEL, 'free']
  )
  await s.close()
})

test('b1d: paid people reach the house model until the credit is spent', async () => {
  const s = await routed({ paid: paid_plan, cost: 4.99 })
  const ok = await fetch(`${s.at}/v1/chat/completions`, {
    method: 'POST',
    headers: s.auth,
    body: JSON.stringify({ model: 'house' })
  })
  assert.equal(ok.status, 200)
  await settle()
  assert.deepEqual([s.sent[0].model, s.recorded[0].plan], [HOUSE_MODEL, 'paid'])
  await s.close()
  const spent = await routed({ paid: paid_plan, cost: 5 })
  const refused = await fetch(`${spent.at}/chat/completions`, {
    method: 'POST',
    headers: spent.auth,
    body: JSON.stringify({ model: 'house' })
  })
  assert.equal((await refused.json()).error.limit, 'credit')
  await spent.close()
})

test('b1c: GET /limit answers the caller, with CORS for the pay page', async () => {
  const s = await routed({ paid: paid_plan, cost: 4.5 })
  const reply = await fetch(`${s.at}/limit`, {
    headers: { ...s.auth, origin: 'https://realness-development.web.app' }
  })
  assert.equal(
    reply.headers.get('access-control-allow-origin'),
    'https://realness-development.web.app'
  )
  const status = await reply.json()
  assert.deepEqual(
    [status.plan, status.warn.limit, status.free.day.used],
    ['paid', 'credit', 10]
  )
  assert.equal((await fetch(`${s.at}/limit`)).status, 401)
  assert.equal(
    (await (await fetch(`${s.at}/pay/limit`, { headers: s.auth })).json()).plan,
    'paid'
  )
  const stranger = await fetch(`${s.at}/limit`, {
    headers: { ...s.auth, origin: 'https://evil.test' }
  })
  assert.equal(stranger.headers.get('access-control-allow-origin'), null)
  const preflight = await fetch(`${s.at}/pay/checkout`, {
    method: 'OPTIONS',
    headers: { origin: 'https://realness-development.web.app' }
  })
  assert.equal(preflight.status, 204)
  await s.close()
})

test('b1d: checkout is off without Stripe, on with it', async () => {
  const off = await routed({})
  assert.equal(
    (
      await fetch(`${off.at}/pay/checkout`, {
        method: 'POST',
        headers: off.auth
      })
    ).status,
    503
  )
  await off.close()
  const stripe = {
    post: async () => ({ url: 'https://checkout.stripe.com/c/x' }),
    get: async () => ({})
  }
  const on = await routed({ stripe })
  assert.equal(
    (
      await (
        await fetch(`${on.at}/pay/checkout`, {
          method: 'POST',
          headers: on.auth
        })
      ).json()
    ).url,
    'https://checkout.stripe.com/c/x'
  )
  assert.equal(
    (await fetch(`${on.at}/pay/checkout`, { method: 'POST' })).status,
    401
  )
  await on.close()
})

test('b1d: a signed webhook writes the plan; an unsigned one does nothing', async () => {
  const stripe = {
    get: async () => ({
      id: 'sub_1',
      customer: 'cus_1',
      metadata: { phone: '+14155550123' },
      current_period_start: 1_790_812_800,
      current_period_end: 1_793_491_200
    })
  }
  const s = await routed({ stripe })
  const raw = JSON.stringify({
    type: 'invoice.paid',
    data: { object: { id: 'in_1', amount_paid: 500, subscription: 'sub_1' } }
  })
  const time = Math.floor(Date.now() / 1000)
  const signature = `t=${time},v1=${createHmac('sha256', 'whsec_t').update(`${time}.${raw}`).digest('hex')}`
  assert.equal(
    (await fetch(`${s.at}/pay/webhook`, { method: 'POST', body: raw })).status,
    400
  )
  assert.equal(s.put.length, 0)
  assert.equal(
    (
      await fetch(`${s.at}/pay/webhook`, {
        method: 'POST',
        headers: { 'stripe-signature': signature },
        body: raw
      })
    ).status,
    200
  )
  assert.deepEqual(
    [s.put[0].phone, s.put[0].credit, s.put[0].start],
    ['+14155550123', 5, '2026-10-01']
  )
  await s.close()
})
