#!/usr/bin/env node
/**
 * Run the sync service on disk storage.
 *
 *   npm run dev     local tokens for two made-up numbers, data in dist/sync-data
 *   PROJECT=realness-online SYNC_DIR=... npm start     real Realness tokens
 */
import { resolve } from "node:path"
import { google_certs } from "brayness-can"
import { disk } from "../src/disk.js"
import { dev_issuer } from "../src/dev-token.js"
import { rights } from "../src/rights.js"
import { sync_service } from "../src/server.js"

const dev = process.argv.includes("--dev")
const port = Number(process.env.PORT ?? 8787)
const dir = resolve(process.env.SYNC_DIR ?? new URL("../../dist/sync-data", import.meta.url).pathname)
const storage = disk(dir)

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

sync_service({ storage, rights: rights(storage), project, certs }).listen(port, "127.0.0.1", () =>
  console.log(`# sync service on http://127.0.0.1:${port}, storage ${dir}`),
)
