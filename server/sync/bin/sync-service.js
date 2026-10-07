#!/usr/bin/env node
/**
 * Run the sync service.
 *
 *   npm run dev                         local tokens, disk at <out>/sync-data
 *   STORE=gcs GCS_BUCKET=... npm run dev  local tokens, a real bucket
 *   PROJECT=realness-online STORE=gcs GCS_BUCKET=... npm start
 *
 * GCS_PREFIX scopes every key, e.g. brayness-test/<run>/ while trying it out.
 * ORIGINS lists the sites a browser may call from, comma separated.
 * On Cloud Run (K_SERVICE is set) tokens come from the metadata server.
 */
import { resolve } from "node:path"
import { google_certs } from "#root/lib/can/src/index.js"
import { disk } from "#root/lib/can/src/disk.js"
import { create_gcs, gcloud_token, metadata_token } from "#root/lib/can/src/gcs.js"
import { dev_issuer } from "../src/dev-token.js"
import { rights } from "../src/rights.js"
import { sync_service } from "../src/server.js"
import { out_path } from "#root/lib/output.js"

const dev = process.argv.includes("--dev")
const port = Number(process.env.PORT ?? 8787)
// LISTEN=0.0.0.0 lets dev actors reach it through their gateway.
const host = process.env.LISTEN ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1")

const open_store = () => {
  const kind = process.env.STORE ?? "disk"
  if (kind === "disk") {
    const dir = resolve(process.env.SYNC_DIR ?? out_path("sync-data"))
    return { storage: disk(dir), where: dir }
  }
  if (kind === "gcs") {
    const bucket = process.env.GCS_BUCKET
    if (!bucket) throw new Error("STORE=gcs needs GCS_BUCKET")
    const prefix = process.env.GCS_PREFIX ?? ""
    const token = process.env.K_SERVICE ? metadata_token() : gcloud_token()
    return { storage: create_gcs({ bucket, token, prefix }), where: `gs://${bucket}/${prefix}` }
  }
  throw new Error(`unknown STORE=${kind}; use disk or gcs`)
}

const { storage, where } = open_store()
let project = process.env.PROJECT
let certs
if (dev) {
  const issuer = dev_issuer()
  ;({ project, certs } = issuer)
  console.log("# dev tokens, valid one hour:")
  console.log(`export A=${issuer.token("+15555550100")}`)
  console.log(`export B=${issuer.token("+15555550101")}`)
} else {
  if (!project) throw new Error("set PROJECT, e.g. realness-online")
  certs = google_certs()
}

const origins = (process.env.ORIGINS ?? "").split(",").filter(Boolean)
// m8: both come from Secret Manager; without them the alert route answers 401.
const alerts = { alert_token: process.env.ALERT_TOKEN, alert_webhook: process.env.HOST_ALERT_WEBHOOK }

sync_service({ storage, rights: rights(storage), project, certs, origins, host_pass_secret: process.env.HOST_PASS_SECRET, ...alerts }).listen(port, host, () =>
  console.log(`# sync service on http://${host}:${port}, storage ${where}`),
)
