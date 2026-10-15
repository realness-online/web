#!/usr/bin/env node
import { make_gate, one_host } from '../../../src/gate/gate.js'
import { gce_start, make_waker, tcp_probe } from '../../../src/gate/wake.js'
import { phone_identity } from '#root/src/proxy/identity.js'
import { create_gcs, gcloud_token, metadata_token } from '#root/src/can/gcs.js'
import {
  lifecycle_html,
  lifecycle_key,
  read_lifecycle
} from '#root/src/sync/host-lifecycle.js'

const env = process.env
const secret = env.HOST_PASS_SECRET?.trim()
if (!secret) throw new Error('gate needs HOST_PASS_SECRET')
const token = env.K_SERVICE ? metadata_token() : gcloud_token()
const identify = phone_identity({
  project: env.IDENTITY_PROJECT,
  bucket: env.PINS_BUCKET,
  token
})
const origins = (env.ORIGINS ?? '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)
const host_for = one_host(
  env.GATE_HOST,
  env.GATE_API_PORT ? Number(env.GATE_API_PORT) : undefined
)

/** Wake is on only when the gate knows which instance it may start. */
const waker = () => {
  const name = env.GATE_HOST_NAME
  const zone = env.GATE_HOST_ZONE
  if (!name || !zone) return undefined
  const records = create_gcs({
    bucket: env.PINS_BUCKET,
    token,
    prefix: env.GCS_PREFIX ?? ''
  })
  return make_waker({
    probe: () => tcp_probe(host_for()),
    start: gce_start({
      project: String(env.GATE_HOST_PROJECT ?? env.IDENTITY_PROJECT),
      zone,
      name,
      token: async () => String(await token())
    }),
    read_intent: async () => {
      const file = await records.get(lifecycle_key(name))
      return file ? read_lifecycle(file.body.toString('utf8')) : null
    },
    write_intent: record =>
      records.put(lifecycle_key(name), lifecycle_html(record)),
    stage: stage => console.info(`gate: ${name}: ${stage}`)
  })
}

const gate = make_gate({ identify, host_for, secret, origins, wake: waker() })

const port = Number(env.PORT ?? 8792)
const listen = env.LISTEN ?? (env.K_SERVICE ? '0.0.0.0' : '127.0.0.1')
gate.listen(port, listen, () =>
  console.log(`gate on ${listen}:${port} -> ${env.GATE_HOST}`)
)
