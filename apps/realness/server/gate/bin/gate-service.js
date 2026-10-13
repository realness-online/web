#!/usr/bin/env node
import { make_gate, one_host } from "../../../src/gate/gate.js"
import { phone_identity } from "#root/src/proxy/identity.js"
import { gcloud_token, metadata_token } from "#root/src/can/gcs.js"

const env = process.env
const secret = env.HOST_PASS_SECRET?.trim()
if (!secret) throw new Error("gate needs HOST_PASS_SECRET")
const token = env.K_SERVICE ? metadata_token() : gcloud_token()
const identify = phone_identity({ project: env.IDENTITY_PROJECT, bucket: env.PINS_BUCKET, token })
const origins = (env.ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean)
const gate = make_gate({ identify, host_for: one_host(env.GATE_HOST, env.GATE_API_PORT), secret, origins })

const port = Number(env.PORT ?? 8792)
const listen = env.LISTEN ?? (env.K_SERVICE ? "0.0.0.0" : "127.0.0.1")
gate.listen(port, listen, () => console.log(`gate on ${listen}:${port} -> ${env.GATE_HOST}`))
