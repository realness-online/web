import assert from "node:assert/strict"
import { test } from "node:test"
import { usage_row } from "#root/server/proxy/src/usage.js"
import { apart, reconcile_models, reconcile_text } from "../src/reconcile.js"
import { attention } from "../src/attention.js"
import { gather, overview_text } from "../src/overview.js"

const A = "+14155550123", B = "+14155550124"
const row = (cost) => usage_row({ model: "m", actor: "a-abcdef123456", payer: A, status: 200, request_bytes: 1, reply_bytes: 1, usage: { prompt_tokens: 10, completion_tokens: 5, cost } })
// A sync stand-in over usage/<phone>/<day>/<file> -> html.
const fake_sync = (files) => ({
  ls: async (url) => {
    const prefix = url.replace("can://", "")
    const names = new Set(Object.keys(files).filter((key) => key.startsWith(prefix)).map((key) => {
      const rest = key.slice(prefix.length)
      return rest.includes("/") ? `${rest.split("/")[0]}/` : rest
    }))
    if (!names.size) throw Object.assign(new Error("404"), { status: 404 })
    return [...names]
  },
  cat: async (url) => {
    const body = files[url.replace("can://", "")]
    if (body === undefined) throw Object.assign(new Error("404"), { status: 404 })
    return Buffer.from(body)
  },
})
const files = {
  [`usage/${A}/2026-10-03/1-a.html`]: row(0.25),
  [`usage/${B}/2026-10-03/2-a.html`]: row(0.5),
  [`usage/${B}/2026-10-01/3-a.html`]: row(1),
  [`usage/${A}/2026-09-30/4-a.html`]: row(9), // last month
}
const config = { cloud: { project: "realness-development", openrouter: { key_secret: "OPENROUTER_API_KEY" } } }
const run = async (command, args) => (args.includes("--secret=OPENROUTER_API_KEY") ? { ok: true, out: "sk-or-v1-proxy\n", err: "" } : { ok: false, out: "", err: "" })
const openrouter = (day, month) => {
  const asked = []
  return { asked, fetcher: async (url, init) => (asked.push({ url, auth: init.headers.authorization }), new Response(JSON.stringify({ data: { label: "sk-or-v1-abc...xyz", usage_daily: day, usage_monthly: month } }))) }
}
const now = Date.parse("2026-10-03T12:00:00Z")

test("o8: the ledger matches the proxy key's totals, today and this month", async () => {
  const or = openrouter(0.75, 1.75)
  const found = await reconcile_models(fake_sync(files), config, { now, run, fetcher: or.fetcher })
  assert.deepEqual([found.ledger.day, found.ledger.month], [0.75, 1.75])
  assert.deepEqual(found.gaps, [])
  assert.deepEqual(or.asked, [{ url: "https://openrouter.ai/api/v1/key", auth: "Bearer sk-or-v1-proxy" }])
  assert.doesNotMatch(JSON.stringify(found), /sk-or-v1-proxy/) // the key never lands in output
  assert.match(reconcile_text(found), /matches/)
})

test("o8: a planted gap is caught: spend the ledger never saw", async () => {
  const found = await reconcile_models(fake_sync(files), config, { now, run, fetcher: openrouter(0.91, 1.91).fetcher })
  assert.deepEqual(found.gaps.map((g) => g.span), ["day", "month"])
  assert.match(reconcile_text(found), /day: openrouter is \$0\.1600 over the ledger/)
  const lines = attention({ reconcile: found }, {}, now)
  assert.match(lines[0].text, /models today: openrouter \$0\.9100, ledger \$0\.7500/)
})

test("o8: rounding is not a gap; a cent and a percent is", () => {
  assert.equal(apart(1.004, 1.0), false)
  assert.equal(apart(0.005, 0), false)
  assert.equal(apart(1.2, 1.0), true)
  assert.equal(apart(0.16, 0), true)
})

test("o8: an empty ledger is zero; missing setup refuses plainly", async () => {
  const found = await reconcile_models(fake_sync({}), config, { now, run, fetcher: openrouter(0, 0).fetcher })
  assert.deepEqual([found.ledger.month, found.gaps.length], [0, 0])
  await assert.rejects(reconcile_models(fake_sync(files), { cloud: {} }, { now, run }), /cloud.openrouter/)
  await assert.rejects(reconcile_models(fake_sync(files), { cloud: { project: "p", openrouter: { key_secret: "NOPE" } } }, { now, run }), /no secret NOPE/)
})

test("o8: status notes missing setup without failing", async () => {
  const view = await gather({ now }, ["reconcile"], { reconcile: async () => ({ setup: "no secret X" }) })
  assert.deepEqual(view.unread, [])
  assert.match(overview_text(view, []), /reconcile: not set up/)
})

import { check_bill, bill_days, cloud_text } from "../src/reconcile.js"

const bill = (day, service, net) => ({ day, service, net })
const expected = ["Cloud Run", "Cloud Storage"]
const quiet_week = ["09-24", "09-25", "09-26", "09-27", "09-28", "09-29", "09-30"].map((d) => bill(`2026-${d}`, "Cloud Run", 1))

test("o8 gcp: a normal day against expected services matches", () => {
  const found = check_bill([...quiet_week, bill("2026-10-01", "Cloud Run", 1.5), bill("2026-10-01", "Cloud Storage", 0.2)], expected)
  assert.deepEqual([found.latest, found.total.toFixed(2), found.baseline, found.gaps], ["2026-10-01", "1.70", 1, []])
  assert.match(cloud_text(found), /matches/)
})

test("o8 gcp: a planted spike and an unexpected service are caught", () => {
  const found = check_bill([...quiet_week, bill("2026-10-01", "Cloud Run", 2.5), bill("2026-10-01", "Vertex AI", 0.4)], expected)
  assert.deepEqual(found.gaps.map((g) => g.kind), ["unexpected", "spike"])
  assert.equal(found.gaps[0].service, "Vertex AI")
  const lines = attention({ bill: found }, {}, Date.now())
  assert.match(lines.map((l) => l.text).join("\n"), /unexpected service: Vertex AI, \$0\.40[\s\S]*\$2\.90 on 2026-10-01, over twice/)
})

test("o8 gcp: cents never spike; free unknown services are not flagged; no rows is quiet", () => {
  const cents = check_bill([bill("2026-09-30", "Cloud Run", 0.01), bill("2026-10-01", "Cloud Run", 0.5)], expected)
  assert.deepEqual(cents.gaps, []) // under the $1 floor
  assert.deepEqual(check_bill([bill("2026-10-01", "Firebase Hosting", 0)], expected).gaps, [])
  assert.equal(check_bill([], expected).latest, null)
})

test("o8 gcp: the bill query is per project and refuses without an export", async () => {
  let sql
  const run = async (command, args) => ((sql = args.at(-1)), { ok: true, out: '[{"day":"2026-10-01","service":"Cloud Run","net":"1.5"}]', err: "" })
  const rows = await bill_days({ project: "realness-development", billing: "realness-development.billing.gcp_billing_export_v1_X" }, { run })
  assert.deepEqual(rows, [{ day: "2026-10-01", service: "Cloud Run", net: 1.5 }])
  assert.match(sql, /project\.id = 'realness-development'/)
  await assert.rejects(bill_days({ project: "realness-development", billing: null }, { run }), /no billing export/)
})
