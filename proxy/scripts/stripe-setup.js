#!/usr/bin/env node
// b1d: make Stripe ready for the proxy. Safe to run again.
//
//   node proxy/scripts/stripe-setup.js            realness-development
//   PROJECT=... node proxy/scripts/stripe-setup.js
//
// Reads STRIPE_SECRET_KEY from Secret Manager, then:
//   1. the $5/month price, found later by lookup key `brayness-plan-monthly`
//   2. a webhook to <proxy>/pay/webhook for paid invoices and cancellations
//   3. its signing secret, stored as STRIPE_WEBHOOK_SECRET
// Then redeploy the proxy (proxy/scripts/deploy.sh) to turn payments on.
import { execFileSync } from "node:child_process"
import { PLAN, PRICE_KEY, WEBHOOK_EVENTS, stripe_api } from "../src/billing.js"

const project = process.env.PROJECT ?? "realness-development"
const region = process.env.REGION ?? "us-central1"
const gcloud = (args, input) => execFileSync("gcloud", [...args, `--project=${project}`], { encoding: "utf8", input, stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] }).trim()
const secret = (name) => { try { return gcloud(["secrets", "versions", "access", "latest", `--secret=${name}`]) } catch { return null } }

const key = secret("STRIPE_SECRET_KEY")
if (!key) throw new Error(`no STRIPE_SECRET_KEY in ${project}; add it with: gcloud secrets create STRIPE_SECRET_KEY --data-file=- --project=${project}`)
const live = key.startsWith("sk_live_") || key.startsWith("rk_live_")
console.log(`stripe: ${live ? "LIVE" : "test"} mode`)
const stripe = stripe_api(key)

// 1. price
const prices = await stripe.get(`/prices?active=true&lookup_keys[]=${PRICE_KEY}`)
let price = prices.data[0]
if (!price) {
  const product = await stripe.post("/products", { name: PLAN.name, description: "House model with model use at cost" })
  price = await stripe.post("/prices", { product: product.id, unit_amount: PLAN.amount, currency: PLAN.currency, recurring: { interval: PLAN.interval }, lookup_key: PRICE_KEY })
  console.log(`price: created ${price.id}`)
} else console.log(`price: ${price.id} exists`)

// 2-3. webhook
const proxy = gcloud(["run", "services", "describe", "brayness-proxy", `--region=${region}`, "--format=value(status.url)"])
const url = `${proxy}/pay/webhook`
const endpoints = await stripe.get("/webhook_endpoints?limit=100")
const existing = endpoints.data.find((endpoint) => endpoint.url === url)
const stored = secret("STRIPE_WEBHOOK_SECRET")
if (existing && stored) console.log(`webhook: ${existing.id} exists`)
else {
  // Stripe shows a signing secret only at creation, so a lost one means a new endpoint.
  if (existing) await stripe.post(`/webhook_endpoints/${existing.id}`, { disabled: true })
  const endpoint = await stripe.post("/webhook_endpoints", { url, enabled_events: WEBHOOK_EVENTS, description: "brayness proxy" })
  try { gcloud(["secrets", "describe", "STRIPE_WEBHOOK_SECRET"]) } catch { gcloud(["secrets", "create", "STRIPE_WEBHOOK_SECRET", "--replication-policy=automatic"]) }
  gcloud(["secrets", "versions", "add", "STRIPE_WEBHOOK_SECRET", "--data-file=-"], endpoint.secret)
  console.log(`webhook: created ${endpoint.id} -> ${url}; secret stored`)
}
const account = gcloud(["run", "services", "describe", "brayness-proxy", `--region=${region}`, "--format=value(spec.template.spec.serviceAccountName)"])
for (const name of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) {
  gcloud(["secrets", "add-iam-policy-binding", name, `--member=serviceAccount:${account}`, "--role=roles/secretmanager.secretAccessor", "--condition=None"])
}
console.log("next: proxy/scripts/deploy.sh")
