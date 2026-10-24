#!/usr/bin/env node
import { halo_pass_secret } from '#root/src/sign-on/node/halo-secret.js'
import { make_gate, one_halo } from '../../../src/gate/gate.js'
import { placed_halos } from '../../../src/gate/placement.js'
import { gce_start, make_waker, tcp_probe } from '../../../src/gate/wake.js'
import { phone_identity } from '#root/src/proxy/identity.js'
import { gcloud_token, metadata_token } from '#root/src/can/gcs.js'
import { disk } from '#root/src/can/disk.js'
import { environment_settings } from '#root/src/settings/environments.js'
import { parseArgs as parse_args } from 'node:util'
import { sync_records } from '../../../src/gate/sync-records.js'
import {
  lifecycle_html,
  lifecycle_key,
  read_lifecycle
} from '#root/src/sync/halo-lifecycle.js'

const { env } = process
/** The gate names its environment on the command line; sync's address comes from it. */
const { values: args } = parse_args({
  options: { environment: { type: 'string' } }
})
const { sync_url } = environment_settings(args.environment ?? '').services
const secret = halo_pass_secret(env)?.trim()
if (!secret) throw new Error('gate needs HALO_PASS_SECRET')
const token = env.K_SERVICE ? metadata_token() : gcloud_token()
const identify = phone_identity({
  project: env.IDENTITY_PROJECT,
  bucket: env.PINS_BUCKET,
  storage: env.PINS_DIR ? disk(env.PINS_DIR) : undefined,
  token
})
const origins = (env.ORIGINS ?? '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)
/**
 * The gate holds no bucket access: its records go through sync, whose rules
 * allow only the woken halo's lifecycle and the placements.
 */
const records = () =>
  sync_records({
    url: sync_url,
    secret,
    halo: String(env.GATE_HALO_NAME)
  })

/** hs-n2: the placement reads and writes through sync. */
const store = () => {
  const sync = records()
  return {
    read: key => sync.get(key),
    write: (key, body) => sync.put(key, body)
  }
}

/**
 * hs-n2: with GATE_HALOS each person keeps one halo; with GATE_HALO everyone
 * shares it. hs-n1 runs both halos on the same code, so this is a config change.
 */
const halo_for = env.GATE_HALOS
  ? placed_halos({ addresses: JSON.parse(env.GATE_HALOS), ...store() })
  : /** @type {(who: { phone: string, actor?: string }) => Promise<{ host: string, port: number, api_port: number }>} */ (
      (() => {
        const one = one_halo(
          env.GATE_HALO,
          env.GATE_API_PORT ? Number(env.GATE_API_PORT) : undefined
        )
        return async () => one()
      })()
    )

/** A probe needs a halo, not a person; this phone only picks the first one. */
const PROBE_PHONE = '+14155550000'

/** Wake is on only when the gate knows which instance it may start. */
const waker = () => {
  const name = env.GATE_HALO_NAME
  const zone = env.GATE_HALO_ZONE
  if (!name || !zone) return undefined
  return make_waker({
    /** Any halo answers the probe; which one does not matter for liveness. */
    probe: async () => tcp_probe(await halo_for({ phone: PROBE_PHONE })),
    start: gce_start({
      project: String(env.GATE_HALO_PROJECT ?? env.IDENTITY_PROJECT),
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

const gate = make_gate({ identify, halo_for, secret, origins, wake: waker() })

const port = Number(env.PORT ?? 8792)
const listen = env.LISTEN ?? (env.K_SERVICE ? '0.0.0.0' : '127.0.0.1')
gate.listen(port, listen, () =>
  console.log(`gate on ${listen}:${port} -> ${env.GATE_HALO}`)
)
