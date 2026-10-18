#!/usr/bin/env node
import { createServer as create_server } from 'node:http'
import {
  existsSync as exists_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import { phone_identity } from '../../../src/proxy/identity.js'
import {
  agent_handler,
  checkout_handler,
  limit_handler,
  proxy_handler,
  webhook_handler
} from '../../../src/proxy/server.js'
import { usage_ledger } from '../../../src/proxy/usage.js'
import {
  PAY_URL,
  billing_store,
  plan_source,
  price_lookup,
  stripe_api
} from '../../../src/proxy/billing.js'
import { disk } from '#root/src/can/disk.js'
import { create_gcs, gcloud_token, metadata_token } from '#root/src/can/gcs.js'
import { out_path } from '#root/lib/output.js'

const {env} = process
const project = env.IDENTITY_PROJECT ?? 'realness-online'
const bucket = env.PINS_BUCKET
const secret = env.MODEL_PASS_SECRET?.trim()
const key_file = env.OPENROUTER_API_KEY_FILE
const key =
  env.OPENROUTER_API_KEY?.trim() ||
  (key_file && exists_sync(key_file)
    ? read_file_sync(key_file, 'utf8').trim()
    : '')
const storage =
  (env.STORE ?? (env.K_SERVICE ? 'gcs' : 'disk')) === 'disk'
    ? disk(env.PROXY_DIR ?? out_path('proxy-data'))
    : create_gcs({
        bucket,
        token: env.K_SERVICE ? metadata_token() : gcloud_token()
      })
const ledger = usage_ledger(storage)
const billing = billing_store(storage)
const plan_for = plan_source(billing, env)
const identify_phone = phone_identity({ project, bucket, storage })
const pay_url = env.PAY_URL ?? PAY_URL
const stripe = env.STRIPE_SECRET_KEY?.trim()
  ? stripe_api(env.STRIPE_SECRET_KEY.trim())
  : null
const price = stripe ? price_lookup(stripe) : null
const webhook_secret = env.STRIPE_WEBHOOK_SECRET?.trim()
/** @type {string[]} */
const origins = (env.ORIGINS ?? '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

const handler = proxy_handler({
  agent: agent_handler({
    identify_phone,
    secret,
    key,
    ledger,
    plan_for,
    pay_url
  }),
  limit: limit_handler({ identify_phone, secret, ledger, plan_for, pay_url }),
  pay: checkout_handler({ identify_phone, secret, stripe, price, pay_url }),
  webhook: webhook_handler({ stripe, billing, webhook_secret }),
  origins
})
const port = Number(env.PORT ?? 8788)
const listen = env.LISTEN ?? (env.K_SERVICE ? '0.0.0.0' : '127.0.0.1')
create_server(handler).listen(port, listen, () =>
  console.log(`proxy on ${listen}:${port}${stripe ? ', payments on' : ''}`)
)
