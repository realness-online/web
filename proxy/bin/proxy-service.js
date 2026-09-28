#!/usr/bin/env node
import { phone_identity } from "../src/identity.js"
import { agent_service } from "../src/server.js"

const project = process.env.IDENTITY_PROJECT ?? "realness-online"
const bucket = process.env.PINS_BUCKET
const secret = process.env.MODEL_PASS_SECRET?.trim()
const key = process.env.OPENROUTER_API_KEY?.trim()
const identify_phone = phone_identity({ project, bucket })
const port = Number(process.env.PORT ?? 8788)
const listen = process.env.LISTEN ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1")
agent_service({ identify_phone, secret, key, log: (row) => console.log(JSON.stringify(row)) }).listen(port, listen, () =>
  console.log(`proxy on ${listen}:${port}`),
)
