import assert from "node:assert/strict"
import { after, test } from "node:test"
import { createHmac, randomUUID } from "node:crypto"
import { rm } from "node:fs/promises"
import { disk } from "#root/src/can/disk.js"
import { WARN_AT, apply_event, price_lookup, billing_key, billing_store, checkout, form, limit_status, paid_now, plan_html, plan_source, read_plan, verify_stripe } from "../../../src/proxy/billing.js"
import { out_path } from "#root/lib/output.js"

const base = out_path(`billing-test-${randomUUID()}/`)
after(() => rm(base, { recursive: true, force: true }))
const A = "+14155550123"
const plan = { status: "active", credit: 5, start: "2026-10-01", end: "2026-11-01T00:00:00.000Z", subscription: "sub_1", customer: "cus_1", invoice: "in_1" }

test("b1d: a plan round-trips through HTML", () => {
  assert.deepEqual(read_plan(plan_html(plan)), plan)
  assert.equal(read_plan("<p>nothing</p>"), null)
  assert.equal(billing_key(A), `billing/${A}/plan.html`)
})

test("b1d: paid only inside the period; canceled keeps what is paid", () => {
  assert.ok(paid_now(plan, new Date("2026-10-15T00:00:00Z")))
  assert.equal(paid_now(plan, new Date("2026-11-01T00:00:00Z")), null)
  assert.equal(paid_now(plan, new Date("2026-09-30T23:59:59Z")), null)
  assert.ok(paid_now({ ...plan, status: "canceled" }, new Date("2026-10-15T00:00:00Z")))
  assert.equal(paid_now({ ...plan, status: "past_due" }, new Date("2026-10-15T00:00:00Z")), null)
  assert.equal(paid_now(null), null)
})

test("b1d: Stripe form encoding nests keys", () => {
  assert.equal(decodeURIComponent(form({ mode: "subscription", line_items: { 0: { price: "p", quantity: 1 } }, skip: null }).toString()), "mode=subscription&line_items[0][price]=p&line_items[0][quantity]=1")
})

test("b1d: checkout names the phone on the session and the subscription", async () => {
  let sent
  const stripe = { post: async (path, params) => ((sent = { path, params }), { url: "https://checkout.stripe.com/c/x" }) }
  assert.deepEqual(await checkout(stripe, { phone: A, price: "price_1", pay_url: "https://pay.test/pay" }), { url: "https://checkout.stripe.com/c/x" })
  assert.equal(sent.path, "/checkout/sessions")
  assert.equal(sent.params.mode, "subscription")
  assert.equal(sent.params.subscription_data.metadata.phone, A)
  assert.equal(sent.params.success_url, "https://pay.test/pay?paid=1")
  await assert.rejects(checkout(stripe, { phone: "nope", price: "p" }), /phone/)
})

const sign = (raw, secret, time = Math.floor(Date.now() / 1000)) => `t=${time},v1=${createHmac("sha256", secret).update(`${time}.${raw}`).digest("hex")}`

test("b1d: webhook signatures: good, forged, stale", () => {
  const raw = JSON.stringify({ type: "invoice.paid" })
  assert.equal(verify_stripe(raw, sign(raw, "whsec_x"), "whsec_x").type, "invoice.paid")
  assert.throws(() => verify_stripe(raw, sign(raw, "whsec_other"), "whsec_x"), /bad signature/)
  assert.throws(() => verify_stripe(raw, sign(raw, "whsec_x", Math.floor(Date.now() / 1000) - 600), "whsec_x"), /stale/)
  assert.throws(() => verify_stripe(raw, undefined, "whsec_x"), /stale or missing/)
})

test("b1d: a paid invoice tops up; a renewal resets; deletion keeps the period", async () => {
  const billing = billing_store(disk(`${base}${randomUUID()}`), { ttl_ms: 0 })
  const periods = { sub_1: [1_790_812_800, 1_793_491_200] }
  const stripe = { get: async (path) => ({ id: "sub_1", customer: "cus_1", metadata: { phone: A }, items: { data: [{ current_period_start: periods.sub_1[0], current_period_end: periods.sub_1[1] }] } }) }
  const paid = { type: "invoice.paid", data: { object: { id: "in_1", amount_paid: 500, parent: { subscription_details: { subscription: "sub_1" } } } } }
  const first = await apply_event(paid, { stripe, billing })
  assert.deepEqual([first.credit, first.start, first.end], [5, "2026-10-01", "2026-11-01T00:00:00.000Z"])
  periods.sub_1 = [1_793_491_200, 1_796_083_200]
  await apply_event({ ...paid, data: { object: { ...paid.data.object, id: "in_2", subscription: "sub_1" } } }, { stripe, billing })
  const renewed = await billing.get(A)
  assert.deepEqual([renewed.start, renewed.invoice, renewed.status], ["2026-11-01", "in_2", "active"])
  assert.equal(await apply_event({ type: "customer.subscription.deleted", data: { object: { id: "sub_other", metadata: { phone: A } } } }, { stripe, billing }), null)
  await apply_event({ type: "customer.subscription.deleted", data: { object: { id: "sub_1", metadata: { phone: A } } } }, { stripe, billing })
  assert.deepEqual([(await billing.get(A)).status, (await billing.get(A)).credit], ["canceled", 5])
  assert.equal(await apply_event({ type: "charge.refunded", data: { object: {} } }, { stripe, billing }), null)
})

test("b1d: plan_source gives free always and paid inside the period", async () => {
  const billing = { get: async (phone) => (phone === A ? plan : null) }
  const at = new Date("2026-10-10T00:00:00Z")
  const source = plan_source(billing, {})
  assert.equal((await source(A, at)).paid.credit, 5)
  assert.equal((await source("+14155550999", at)).paid, null)
  assert.equal((await source(A, at)).free.day.tokens, 250_000)
})

test(`b1c: warnings at ${WARN_AT.join("% and ")}%, each with a way to pay`, () => {
  const free = { day: { tokens: 1000 }, month: { tokens: 10_000 } }
  const spent = (day, month, cost = 0) => ({ day: { tokens: day, cost: 0 }, month: { tokens: month, cost: 0 }, period: { tokens: 0, cost } })
  assert.equal(limit_status({ free, paid: null }, spent(749, 749)).warn, null)
  assert.deepEqual(limit_status({ free, paid: null }, spent(750, 750)).warn.at, 75)
  assert.deepEqual(limit_status({ free, paid: null }, spent(899, 899)).warn.at, 75)
  const day = limit_status({ free, paid: null }, spent(900, 900), { pay_url: "https://pay.test" })
  assert.deepEqual([day.warn.limit, day.warn.percent, day.warn.at], ["day", 90, 90])
  assert.match(day.warn.message, /https:\/\/pay\.test/)
  assert.equal(limit_status({ free, paid: null }, spent(950, 9500)).warn.limit, "month")
  const credit = limit_status({ free, paid: plan }, spent(0, 0, 4.6))
  assert.deepEqual([credit.plan, credit.warn.limit, credit.paid.left.toFixed(2)], ["paid", "credit", "0.40"])
  assert.match(credit.warn.message, /2026-11-01/)
  assert.equal(limit_status({ free, paid: plan }, spent(0, 0, 1)).warn, null)
  const cut = limit_status({ free, paid: null }, spent(1000, 1000))
  assert.deepEqual([cut.warn.limit, cut.warn.at], ["day", 100])
  assert.match(cut.warn.message, /^Today's free model use is spent\. Model calls stop until midnight UTC\./)
})

test("b1d: the price is found by lookup key, once; a miss retries", async () => {
  let asks = 0, data = []
  const lookup = price_lookup({ get: async (path) => (asks++, assert.match(path, /lookup_keys\[\]=brayness-plan-monthly/), { data }) })
  await assert.rejects(lookup(), /stripe-setup/)
  data = [{ id: "price_1" }]
  assert.equal(await lookup(), "price_1")
  assert.equal(await lookup(), "price_1")
  assert.equal(asks, 2)
})
