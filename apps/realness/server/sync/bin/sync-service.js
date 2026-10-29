#!/usr/bin/env node
/**
 * Run the sync service.
 *
 *   npm run dev                         local tokens, disk at <out>/sync-data
 *   STORE=gcs GCS_BUCKET=... npm run dev  local tokens, a real bucket
 *   PROJECT=realness-online STORE=gcs GCS_BUCKET=... npm start
 *
 * GCS_PREFIX scopes every key, e.g. realness-test/<run>/ while trying it out.
 * ORIGINS lists the sites a browser may call from, comma separated.
 * On Cloud Run (K_SERVICE is set) tokens come from the metadata server.
 */
import { halo_pass_secret } from '#root/src/sign-on/node/halo-secret.js'
import { vault_door } from '#root/src/sync/vault.js'
import { resolve } from 'node:path'
import { google_certs } from '#root/src/can/index.js'
import { disk } from '#root/src/can/disk.js'
import { create_gcs, gcloud_token, metadata_token } from '#root/src/can/gcs.js'
import { token_trust } from '#root/src/sign-in/trust.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'
import { store_of } from '#root/src/can/store.js'
import { gce_statuses } from '#root/src/sync/halo-power.js'
import { sync_dir } from '#root/src/settings/output.js'

const dev = process.argv.includes('--dev')
const port = Number(process.env.PORT ?? 8787)
const host =
  process.env.LISTEN ?? (process.env.K_SERVICE ? '0.0.0.0' : '127.0.0.1')

const open_store = () => {
  const kind = process.env.STORE ?? 'disk'
  if (kind === 'disk') {
    const dir = sync_dir()
    return { storage: disk(dir), where: dir }
  }
  if (kind === 'gcs') {
    const bucket = process.env.GCS_BUCKET
    if (!bucket) throw new Error('STORE=gcs needs GCS_BUCKET')
    const prefix = process.env.GCS_PREFIX ?? ''
    const token = process.env.K_SERVICE ? metadata_token() : gcloud_token()
    return {
      storage: create_gcs({ bucket, token, prefix }),
      where: `gs://${bucket}/${prefix}`
    }
  }
  throw new Error(`unknown STORE=${kind}; use disk or gcs`)
}

/** gz1, st1, st2: every file is `name.gz`, grouped under people and server/. */
const { storage: bytes, where } = open_store()
const storage = store_of(bytes)
let project = process.env.PROJECT
let certs
let issuer
if (dev) {
  const tokens = dev_issuer()
  ;({ project, certs } = tokens)
  console.log('# dev tokens, valid one hour:')
  console.log(`export A=${tokens.token('+15555550100')}`)
  console.log(`export B=${tokens.token('+15555550101')}`)
} else {
  if (!project) throw new Error('set PROJECT, e.g. realness-online')
  ;({ certs = google_certs(), issuer } = token_trust(project))
}

const origins = (process.env.ORIGINS ?? '').split(',').filter(Boolean)
const alerts = {
  alert_token: process.env.ALERT_TOKEN,
  alert_webhook: process.env.HALO_ALERT_WEBHOOK
}
const power_project = process.env.HALO_POWER_PROJECT
const power_token = process.env.K_SERVICE ? metadata_token() : gcloud_token()
const halo_statuses = power_project
  ? gce_statuses({
      project: power_project,
      token: async () => String(await power_token())
    })
  : null
const git_app =
  process.env.GITHUB_APP_ID && process.env.GITHUB_APP_KEY
    ? {
        app_id: process.env.GITHUB_APP_ID,
        private_key: process.env.GITHUB_APP_KEY
      }
    : null

sync_service({
  storage,
  rights: rights(storage),
  project,
  certs,
  issuer,
  origins,
  halo_pass_secret: halo_pass_secret(),
  /** vlt1: on the Mac, the owner's actors search this vault's index here. */
  vault: vault_door({
    dir: process.env.VAULT_DIR ?? null,
    index: process.env.VAULT_INDEX ?? null,
    owner: process.env.VAULT_OWNER ?? null
  }),
  git_app,
  halo_statuses,
  ...alerts
}).listen(port, host, () =>
  console.log(`# sync service on http://${host}:${port}, storage ${where}`)
)
