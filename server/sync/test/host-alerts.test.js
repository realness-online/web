import assert from "node:assert/strict"
import { test } from "node:test"
import { FIRST_REPEAT_MS, REPEAT_MS, host_alerts, run_host_alerts, webhook_body } from "../src/host-alerts.js"

const at = Date.parse("2026-10-05T12:00:00Z")
const quiet = (...names) => names.map((name) => ({ name, checked: "", age_s: 200 }))

/** A storage stub that remembers one record, like the bucket does. */
const memory = (stored = null) => ({
  saved: stored,
  async get(key) {
    return this.saved && key === "alerts/host-watch.json" ? { body: Buffer.from(this.saved) } : null
  },
  async put(key, body) {
    if (key !== "alerts/host-watch.json") throw new Error(`unexpected key ${key}`)
    this.saved = body
  },
  async list() {
    return { files: [], folders: ["brayness-1"] }
  },
})

/** A host record quiet past the threshold, so quiet_hosts sees it. */
const paper = (names) => ({
  ...memory(),
  async get(key) {
    if (key === "alerts/host-watch.json") return this.saved ? { body: Buffer.from(this.saved) } : null
    const name = key.split("/")[1]
    if (!names.includes(name)) return null
    return { body: Buffer.from(`<article itemscope itemtype="/host"><meta itemprop="checked" content="2026-10-05T11:00:00.000Z"></article>`) }
  },
  async put(key, body) {
    this.saved = body
  },
  async list() {
    return { files: [], folders: names }
  },
})

test("a host that goes quiet sends one alert, then nothing until the first repeat is due", () => {
  const first = host_alerts({}, quiet("brayness-1"), at)
  assert.deepEqual(first.map((a) => a.kind), ["down"])
  assert.match(first[0].text, /brayness-1 stopped reporting/)

  const state = { "brayness-1": first[0].next }
  assert.deepEqual(host_alerts(state, quiet("brayness-1"), at + 60_000), [])
  const due = host_alerts(state, quiet("brayness-1"), at + FIRST_REPEAT_MS)
  assert.deepEqual(due.map((a) => a.kind), ["repeat"])
  assert.equal(due[0].next.repeats, 1)
  assert.match(due[0].text, /still quiet \(5m\)/)
})

test("after the first repeat, the same outage repeats hourly", () => {
  const state = { "brayness-1": { since: at, sent: at + FIRST_REPEAT_MS, repeats: 1 } }
  assert.deepEqual(host_alerts(state, quiet("brayness-1"), at + FIRST_REPEAT_MS + REPEAT_MS - 1), [])
  const hourly = host_alerts(state, quiet("brayness-1"), at + FIRST_REPEAT_MS + REPEAT_MS)
  assert.deepEqual(hourly.map((a) => a.kind), ["repeat"])
  assert.equal(hourly[0].next.repeats, 2)
})

test("a host that reports again sends a recovery note and is forgotten", () => {
  const state = { "brayness-1": { since: at, sent: at, repeats: 0 }, "brayness-2": { since: at, sent: at, repeats: 0 } }
  const actions = host_alerts(state, quiet("brayness-2"), at + 1000)
  assert.deepEqual(actions.map((a) => [a.kind, a.name]), [["up", "brayness-1"]])
  assert.equal(actions[0].next, null)
  assert.match(actions[0].text, /reporting again/)
})

test("a quiet list that empties sends nothing for hosts never seen quiet", () => {
  assert.deepEqual(host_alerts({}, [], at), [])
  assert.deepEqual(host_alerts({}, quiet("brayness-1", "brayness-2"), at).map((a) => a.name), ["brayness-1", "brayness-2"])
})

test("Slack reads text, Discord reads content", () => {
  assert.deepEqual(webhook_body("https://hooks.slack.com/services/x", "hi"), { text: "hi" })
  assert.deepEqual(webhook_body("https://discord.com/api/webhooks/x/y", "hi"), { content: "hi" })
})

test("a run sends what is due and keeps only what it sent", async () => {
  const storage = paper(["brayness-1"])
  const webhook = "https://hooks.slack.com/services/x"
  const fetcher = async () => ({ ok: true, status: 200 })
  const first = await run_host_alerts({ storage, webhook, now: () => at, fetcher })
  assert.deepEqual(first, [{ kind: "down", name: "brayness-1" }])
  assert.deepEqual(JSON.parse(storage.saved), { "brayness-1": { since: at, sent: at, repeats: 0 } })

  const second = await run_host_alerts({ storage, webhook, now: () => at + 30_000, fetcher })
  assert.deepEqual(second, [])
  assert.equal(JSON.parse(storage.saved)["brayness-1"].sent, at)
})

test("a failed send keeps the state, so the next run tries again", async () => {
  const storage = paper(["brayness-1"])
  const warned = []
  const fetcher = async () => ({ ok: false, status: 500 })
  const sent = await run_host_alerts({ storage, webhook: "https://hooks.slack.com/services/x", now: () => at, fetcher, warn: (m) => warned.push(m) })
  assert.deepEqual(sent, [])
  assert.equal(storage.saved, null)
  assert.match(warned[0], /webhook answered 500/)

  const retry = await run_host_alerts({ storage, webhook: "https://hooks.slack.com/services/x", now: () => at + 60_000, fetcher: async () => ({ ok: true, status: 200 }) })
  assert.deepEqual(retry, [{ kind: "down", name: "brayness-1" }])
})

test("no webhook configured is a warning per host, never a silent pass", async () => {
  const storage = paper(["brayness-1"])
  const warned = []
  const sent = await run_host_alerts({ storage, now: () => at, warn: (m) => warned.push(m) })
  assert.deepEqual(sent, [])
  assert.match(warned[0], /no HOST_ALERT_WEBHOOK is set/)
})

test("a storage failure skips the pass instead of reporting recovery", async () => {
  const storage = {
    async get() {
      throw new Error("bucket is down")
    },
  }
  const warned = []
  const sent = await run_host_alerts({ storage, webhook: "https://hooks.slack.com/services/x", now: () => at, warn: (m) => warned.push(m) })
  assert.deepEqual(sent, [])
  assert.equal(warned.length, 1)
})