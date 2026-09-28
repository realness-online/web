#!/usr/bin/env node
import { phone_identity } from "../src/identity.js"
import { agent_service } from "../src/server.js"
import { usage_ledger } from "../src/usage.js"
import { create_gcs, gcloud_token, metadata_token } from "brayness-can-store/gcs"

const project = process.env.IDENTITY_PROJECT ?? "realness-online"
const bucket = process.env.PINS_BUCKET
const secret = process.env.MODEL_PASS_SECRET?.trim()
const key = process.env.OPENROUTER_API_KEY?.trim()
const token = process.env.K_SERVICE ? metadata_token() : gcloud_token()
const ledger = usage_ledger(create_gcs({ bucket, token }))
const identify_phone = phone_identity({ project, bucket, token })
const limit = (name) => (process.env[name] ? Number(process.env[name]) : Infinity)
const quota = { tokens: limit("FREE_TOKENS_PER_DAY"), cost: limit("FREE_COST_PER_DAY") }
const port = Number(process.env.PORT ?? 8788)
const listen = process.env.LISTEN ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1")
agent_service({ identify_phone, secret, key, ledger, quota }).listen(port, listen, () =>
  console.log(`proxy on ${listen}:${port}`),
)
