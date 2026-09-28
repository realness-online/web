import assert from "node:assert/strict"
import { after, test } from "node:test"
import { randomUUID } from "node:crypto"
import { rm } from "node:fs/promises"
import { disk } from "brayness-can-store/disk"
import { over_quota, read_rows, usage_key, usage_ledger, usage_meter, usage_row } from "../src/usage.js"

const base = new URL(`../../dist/usage-test-${randomUUID()}/`, import.meta.url).pathname
after(() => rm(base, { recursive: true, force: true }))
const bytes = (text) => new TextEncoder().encode(text)

test("meter finds usage in a stream split mid-line", () => {
  const meter = usage_meter()
  const stream = 'data: {"choices":[{"delta":{"content":"secret reply"}}]}\n\ndata: {"model":"m/x","usage":{"prompt_tokens":7,"completion_tokens":3,"cost":0.002}}\n\ndata: [DONE]\n'
  for (let i = 0; i < stream.length; i += 13) meter.add(bytes(stream.slice(i, i + 13)))
  const { reply_bytes, usage } = meter.finish()
  assert.equal(reply_bytes, bytes(stream).length)
  assert.deepEqual(usage, { prompt_tokens: 7, completion_tokens: 3, cost: 0.002, model: "m/x" })
})

test("meter reads a plain JSON reply; no usage is null", () => {
  const plain = usage_meter()
  plain.add(bytes('{"model":"m","usage":{"prompt_tokens":1,"completion_tokens":2,"cost":0}}'))
  assert.equal(plain.finish().usage.completion_tokens, 2)
  const none = usage_meter()
  none.add(bytes("data: done\n"))
  assert.equal(none.finish().usage, null)
})

test("a row keeps sizes and cost, never text", () => {
  const html = usage_row({ model: "m", actor: "a-abcdef123456", status: 200, request_bytes: 40, reply_bytes: 90, usage: { prompt_tokens: 7, completion_tokens: 3, cost: 0.002 } })
  assert.doesNotMatch(html, /secret|content"\s*>/)
  assert.deepEqual(read_rows(html), [{ model: "m", actor: "a-abcdef123456", status: 200, request_bytes: 40, reply_bytes: 90, prompt_tokens: 7, completion_tokens: 3, cost: 0.002 }])
})

test("attribute values are escaped", () => {
  assert.match(usage_row({ model: '"><script>', actor: "phone", status: 200, request_bytes: 0, reply_bytes: 0 }), /content="&quot;>&lt;script>"/)
})

test("key sits under the person's day", () => {
  assert.match(usage_key("+14155550123", "phone", new Date("2026-09-27T12:34:56.789Z")), /^usage\/\+14155550123\/2026-09-27\/123456789Z-phone-[a-f0-9]{6}\.html$/)
})

test("racing calls each get a file; the day sums them", async () => {
  const ledger = usage_ledger(disk(base))
  const now = new Date("2026-09-27T12:00:00Z")
  const row = { model: "m", actor: "a-abcdef123456", status: 200, request_bytes: 1, reply_bytes: 1, usage: { cost: 0.25 } }
  await Promise.all(Array.from({ length: 20 }, () => ledger.record("+14155550123", row, now)))
  const day = await ledger.day("+14155550123", "2026-09-27")
  assert.equal(day.rows.length, 20)
  assert.equal(day.cost, 5)
  assert.deepEqual((await ledger.day("+14155550123", "2026-09-26")).rows, [])
})

test("spent reads once, then counts in memory", async () => {
  const store = disk(`${base}${randomUUID()}`)
  const now = new Date()
  const row = { model: "m", actor: "phone", status: 200, request_bytes: 1, reply_bytes: 1, usage: { prompt_tokens: 4, completion_tokens: 6, cost: 0.5 } }
  await usage_ledger(store).record("+14155550123", row, now)
  const ledger = usage_ledger(store)
  assert.deepEqual(await ledger.spent("+14155550123", now), { tokens: 10, cost: 0.5 })
  let lists = 0
  const list = store.list
  store.list = (...a) => (lists++, list(...a))
  await ledger.record("+14155550123", row, now)
  assert.deepEqual(await ledger.spent("+14155550123", now), { tokens: 20, cost: 1 })
  assert.equal(lists, 0)
})

test("over quota at either limit", () => {
  assert.equal(over_quota({ tokens: 99, cost: 0 }, { tokens: 100 }), false)
  assert.equal(over_quota({ tokens: 100, cost: 0 }, { tokens: 100 }), true)
  assert.equal(over_quota({ tokens: 0, cost: 1 }, { cost: 1 }), true)
  assert.equal(over_quota({ tokens: 1e9, cost: 1e9 }), false)
})
