import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  FIRST_REPEAT_MS,
  REPEAT_MS,
  halo_alerts,
  run_halo_alerts,
  webhook_body
} from '../../src/sync/halo-alerts.js'

const at = Date.parse('2026-10-05T12:00:00Z')
const quiet = (...names) =>
  names.map(name => ({ name, checked: '', age_s: 200 }))

/** A storage stub that remembers one record, like the bucket does. */
const memory = (stored = null) => ({
  saved: stored,
  async get(key) {
    return this.saved && key === 'alerts/halo-watch.json'
      ? { body: Buffer.from(this.saved) }
      : null
  },
  async put(key, body) {
    if (key !== 'alerts/halo-watch.json')
      throw new Error(`unexpected key ${key}`)
    this.saved = body
  },
  async list() {
    return { files: [], folders: ['realness-1'] }
  }
})

/** A halo record quiet past the threshold, so quiet_halos sees it. */
const paper = names => ({
  ...memory(),
  async get(key) {
    if (key === 'alerts/halo-watch.json')
      return this.saved ? { body: Buffer.from(this.saved) } : null
    const name = key.split('/')[1]
    if (!names.includes(name)) return null
    return {
      body: Buffer.from(
        `<article itemscope itemtype="/halo"><meta itemprop="checked" content="2026-10-05T11:00:00.000Z"></article>`
      )
    }
  },
  async put(key, body) {
    this.saved = body
  },
  async list() {
    return { files: [], folders: names }
  }
})

it('a halo that goes quiet sends one alert, then nothing until the first repeat is due', () => {
  const first = halo_alerts({}, quiet('realness-1'), at)
  assert.deepEqual(
    first.map(a => a.kind),
    ['down']
  )
  assert.match(first[0].text, /realness-1 stopped reporting/)

  const state = { 'realness-1': first[0].next }
  assert.deepEqual(halo_alerts(state, quiet('realness-1'), at + 60_000), [])
  const due = halo_alerts(state, quiet('realness-1'), at + FIRST_REPEAT_MS)
  assert.deepEqual(
    due.map(a => a.kind),
    ['repeat']
  )
  assert.equal(due[0].next.repeats, 1)
  assert.match(due[0].text, /still quiet \(5m\)/)
})

it('after the first repeat, the same outage repeats hourly', () => {
  const state = {
    'realness-1': { since: at, sent: at + FIRST_REPEAT_MS, repeats: 1 }
  }
  assert.deepEqual(
    halo_alerts(
      state,
      quiet('realness-1'),
      at + FIRST_REPEAT_MS + REPEAT_MS - 1
    ),
    []
  )
  const hourly = halo_alerts(
    state,
    quiet('realness-1'),
    at + FIRST_REPEAT_MS + REPEAT_MS
  )
  assert.deepEqual(
    hourly.map(a => a.kind),
    ['repeat']
  )
  assert.equal(hourly[0].next.repeats, 2)
})

it('a halo that reports again sends a recovery note and is forgotten', () => {
  const state = {
    'realness-1': { since: at, sent: at, repeats: 0 },
    'realness-2': { since: at, sent: at, repeats: 0 }
  }
  const actions = halo_alerts(state, quiet('realness-2'), at + 1000)
  assert.deepEqual(
    actions.map(a => [a.kind, a.name]),
    [['up', 'realness-1']]
  )
  assert.equal(actions[0].next, null)
  assert.match(actions[0].text, /reporting again/)
})

it('a quiet list that empties sends nothing for halos never seen quiet', () => {
  assert.deepEqual(halo_alerts({}, [], at), [])
  assert.deepEqual(
    halo_alerts({}, quiet('realness-1', 'realness-2'), at).map(a => a.name),
    ['realness-1', 'realness-2']
  )
})

it('Slack reads text, Discord reads content', () => {
  assert.deepEqual(webhook_body('https://hooks.slack.com/services/x', 'hi'), {
    text: 'hi'
  })
  assert.deepEqual(webhook_body('https://discord.com/api/webhooks/x/y', 'hi'), {
    content: 'hi'
  })
})

it('a run sends what is due and keeps only what it sent', async () => {
  const storage = paper(['realness-1'])
  const webhook = 'https://hooks.slack.com/services/x'
  const fetcher = async () => ({ ok: true, status: 200 })
  const first = await run_halo_alerts({
    storage,
    webhook,
    now: () => at,
    fetcher
  })
  assert.deepEqual(first, [{ kind: 'down', name: 'realness-1' }])
  assert.deepEqual(JSON.parse(storage.saved), {
    'realness-1': { since: at, sent: at, repeats: 0 }
  })

  const second = await run_halo_alerts({
    storage,
    webhook,
    now: () => at + 30_000,
    fetcher
  })
  assert.deepEqual(second, [])
  assert.equal(JSON.parse(storage.saved)['realness-1'].sent, at)
})

it('a failed send keeps the state, so the next run tries again', async () => {
  const storage = paper(['realness-1'])
  const warned = []
  const fetcher = async () => ({ ok: false, status: 500 })
  const sent = await run_halo_alerts({
    storage,
    webhook: 'https://hooks.slack.com/services/x',
    now: () => at,
    fetcher,
    warn: m => warned.push(m)
  })
  assert.deepEqual(sent, [])
  assert.equal(storage.saved, null)
  assert.match(warned[0], /webhook answered 500/)

  const retry = await run_halo_alerts({
    storage,
    webhook: 'https://hooks.slack.com/services/x',
    now: () => at + 60_000,
    fetcher: async () => ({ ok: true, status: 200 })
  })
  assert.deepEqual(retry, [{ kind: 'down', name: 'realness-1' }])
})

it('no webhook configured is a warning per halo, never a silent pass', async () => {
  const storage = paper(['realness-1'])
  const warned = []
  const sent = await run_halo_alerts({
    storage,
    now: () => at,
    warn: m => warned.push(m)
  })
  assert.deepEqual(sent, [])
  assert.match(warned[0], /no HALO_ALERT_WEBHOOK is set/)
})

it('a storage failure skips the pass instead of reporting recovery', async () => {
  const storage = {
    async get() {
      throw new Error('bucket is down')
    }
  }
  const warned = []
  const sent = await run_halo_alerts({
    storage,
    webhook: 'https://hooks.slack.com/services/x',
    now: () => at,
    warn: m => warned.push(m)
  })
  assert.deepEqual(sent, [])
  assert.equal(warned.length, 1)
})
