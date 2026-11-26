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
import { disk_source } from '#root/src/sync/vault-source.js'
import { google_certs } from '#root/src/can/index.js'
import { disk } from '#root/src/can/disk.js'
import { create_gcs, gcloud_token, metadata_token } from '#root/src/can/gcs.js'
import { token_trust } from '#root/src/sign-in/trust.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'
import { vault_events } from '#root/src/sync/vault-events.js'
import { watch_vault_disk } from '#root/src/sync/vault-watch.js'
import { store_of } from '#root/src/can/store.js'
import { flush_marks, rebuild_all } from '#root/src/can/marks.js'
import { MS_PER_DAY } from '#root/lib/units.js'
import { routed } from '#root/src/can/routed.js'
import { gce_statuses } from '#root/src/sync/halo-power.js'
import { icloud_sync, sync_dir } from '#root/src/settings/output.js'
import { dirname, join } from 'node:path'
import { production_copy } from '#root/src/sync/mirror.js'
import { find_root } from '#root/src/harness/harness.js'
import { deployment_settings } from '#root/src/settings/environments.js'
import { cloud_admitter, local_admitter } from '#root/src/files/local-admit.js'
import { trash_dir } from '#root/src/files/client.js'
import { use_harness_state } from '#root/src/harness/harness.js'

const DEFAULT_PORT = 8787

const dev = process.argv.includes('--dev')
const port = Number(process.env.PORT ?? DEFAULT_PORT)
const host =
  process.env.LISTEN ?? (process.env.K_SERVICE ? '0.0.0.0' : '127.0.0.1')

const open_store = () => {
  const kind = process.env.STORE ?? 'disk'
  if (kind === 'disk') {
    const dir = sync_dir()
    return { storage: disk(dir), where: dir, copies: dir === icloud_sync() }
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

const vault_dir = process.env.VAULT_DIR ?? null
const vault_index = process.env.VAULT_INDEX ?? null
const vault_owner = process.env.VAULT_OWNER ?? null
const quarantine_dir = process.env.QUARANTINE_DIR ?? null

/** gz1, st1, st2: every file is `name.gz`, grouped under people and server/. */
const { storage: bytes, where, copies } = open_store()
/** h1: only the cloud bucket keeps each person's hash page. */
const marks = { marks: process.env.STORE === 'gcs' }
/** l2: on the Mac, the owner's quarantine is a plain folder in the vault. */
const storage =
  quarantine_dir && vault_owner
    ? routed(
        store_of(bytes, marks),
        `people/${vault_owner}/quarantine/`,
        disk(quarantine_dir)
      )
    : store_of(bytes, marks)
let project = process.env.PROJECT
let certs
let issuer
if (dev) {
  const tokens = dev_issuer()
  ;({ project, certs } = tokens)
  console.info('# dev tokens, valid one hour:')
  console.info(`export A=${tokens.token('+15555550100')}`)
  console.info(`export B=${tokens.token('+15555550101')}`)
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

const artifacts_dir = process.env.ARTIFACTS_DIR ?? null
const events = vault_events()

if (vault_dir && vault_index && vault_owner)
  watch_vault_disk({
    dir: vault_dir,
    index: vault_index,
    owner: vault_owner,
    events,
    log: line => console.info(`# vault ${line}`)
  })

/** c1: in the cloud, the sync server admits each person's quarantine itself. */
const admitter =
  quarantine_dir && vault_dir && vault_owner
    ? local_admitter({
        storage,
        owner: vault_owner,
        root: dirname(vault_dir),
        trash: trash_dir(use_harness_state(dirname(vault_dir))),
        log: line => console.info(`# ${line}`)
      })
    : cloud_admitter({ storage, log: line => console.info(`# ${line}`) })
admitter?.start()

sync_service({
  events,
  on_hold: owner => admitter?.poke(owner),
  storage,
  rights: rights(storage),
  project,
  certs,
  issuer,
  origins,
  halo_pass_secret: halo_pass_secret(),
  /** vlt1: on the Mac, the owner's vault folder; in the cloud, each person's storage. */
  vault:
    vault_dir && vault_owner
      ? vault_door({
          source: disk_source(vault_dir),
          owner: vault_owner,
          dir: vault_dir,
          artifacts: artifacts_dir
        })
      : null,
  git_app,
  halo_statuses,
  ...alerts
}).listen(port, host, () =>
  console.info(`# sync service on http://${host}:${port}, storage ${where}`)
)
if (copies)
  production_copy({
    page: join(find_root(), 'vault/Switches.html'),
    to: bytes,
    from: () =>
      create_gcs({
        bucket: deployment_settings('production').bucket,
        token: gcloud_token()
      }),
    write: true
  })
    .then(result =>
      console.info(
        result
          ? `# production copy: copied ${result.copied}, removed ${result.removed}`
          : '# production copy is off'
      )
    )
    .catch(error => console.error(`# production copy failed: ${error.message}`))
if (marks.marks) {
  const day = setInterval(
    () => rebuild_all(storage).catch(console.error),
    MS_PER_DAY
  )
  day.unref()
  for (const signal of ['SIGTERM', 'SIGINT'])
    process.on(signal, async () => {
      await flush_marks()
      process.exit(0)
    })
}
