#!/usr/bin/env node
import { make_gate, one_host } from '../../../src/gate/gate.js'
import { placed_hosts } from '../../../src/gate/placement.js'
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
/** hs-n2: the placement reads and writes through the sync bucket. */
const store = () => {
  const gcs = records()
  return { read: key => gcs.get(key), write: (key, body) => gcs.put(key, body) }
}

/** hs-n2: the record store the placement reads and writes; sync's bucket. */
const records = () =>
  create_gcs({
    bucket: env.PINS_BUCKET,
    token,
    prefix: env.GCS_PREFIX ?? ''
  })

/**
 * hs-n2: with GATE_HOSTS each person keeps one host; with GATE_HOST everyone
 * shares it. hs-n1 runs both hosts on the same code, so this is a config change.
 */
const host_for = env.GATE_HOSTS
  ? placed_hosts({ addresses: JSON.parse(env.GATE_HOSTS), ...store() })
  : /** @type {(who: { phone: string, actor?: string }) => Promise<{ host: string, port: number, api_port: number }>} */ (
      (() => {
        const one = one_host(
          env.GATE_HOST,
          env.GATE_API_PORT ? Number(env.GATE_API_PORT) : undefined
        )
        return async () => one()
      })()
    )

/** A probe needs a host, not a person; this phone only picks the first one. */
const PROBE_PHONE = '+14155550000'

/** Wake is on only when the gate knows which instance it may start. */
const waker = () => {
  const name = env.GATE_HOST_NAME
  const zone = env.GATE_HOST_ZONE
  if (!name || !zone) return undefined
  return make_waker({
    // Any host answers the probe; which one does not matter for liveness.
    probe: async () => tcp_probe(await host_for({ phone: PROBE_PHONE })),
    start: gce_start({
      project: String(env.GATE_HOST_PROJECT ?? env.IDENTITY_PROJECT),
      zone,
      name,
      token: async () => String(await token())
    }),
    read_intent: async () => {
      const file = await records().get(lifecycle_key(name))
      return file ? read_lifecycle(file.body.toString('utf8')) : null
    },
    write_intent: record =>
      records().put(lifecycle_key(name), lifecycle_html(record)),
    stage: stage => console.info(`gate: ${name}: ${stage}`)
  })
}

const gate = make_gate({ identify, host_for, secret, origins, wake: waker() })

const port = Number(env.PORT ?? 8792)
const listen = env.LISTEN ?? (env.K_SERVICE ? '0.0.0.0' : '127.0.0.1')
gate.listen(port, listen, () =>
  console.log(`gate on ${listen}:${port} -> ${env.GATE_HOST}`)
)
