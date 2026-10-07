#!/usr/bin/env node
// h3 baseline: time a one-file change in a 6,000-file harness, and count requests.
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { disk } from "#root/lib/can/src/disk.js"
import { create_gcs, gcloud_token } from "#root/lib/can/src/gcs.js"
import { client } from "#root/lib/files/src/client.js"
import { dev_issuer } from "#root/server/sync/src/dev-token.js"
import { sync_harness } from "#root/lib/harness/src/harness.js"
import { rights } from "#root/server/sync/src/rights.js"
import { sync_service } from "#root/server/sync/src/server.js"
import { out_path } from "#root/lib/output.js"

const FILES = Number(process.env.FILES ?? 6000)
const base = out_path("h3-baseline")
await rm(base, { recursive: true, force: true })
const harness = join(base, "harness")
await mkdir(join(base, "bucket"), { recursive: true })
// BUCKET=<name> measures a real bucket under a throwaway prefix, deleted after.
const prefix = `h3-test-${Date.now()}/`
const storage = process.env.BUCKET ? create_gcs({ bucket: process.env.BUCKET, token: gcloud_token(), prefix }) : disk(join(base, "bucket"))
if (process.env.BUCKET) console.log(`bucket gs://${process.env.BUCKET}/${prefix}`)
const issuer = dev_issuer()
let requests = 0
const server = sync_service({ storage, rights: rights(storage), project: issuer.project, certs: issuer.certs, log: () => { requests += 1 } })
await new Promise((done) => server.listen(0, "127.0.0.1", done))
const store = client({ url: `http://127.0.0.1:${server.address().port}`, token: issuer.token("+15555550199") })

await mkdir(harness, { recursive: true })
await writeFile(join(harness, ".ignore"), "")
for (let i = 0; i < FILES; i++) {
  const dir = join(harness, "notes", String(i % 60))
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${i}.md`), `note ${i}\n`)
}
const timed = async (label) => {
  requests = 0
  const start = performance.now()
  const report = await sync_harness({ root: harness, store })
  console.log(`${label}: ${Math.round(performance.now() - start)} ms, ${requests} requests, ${report.harness.files.listing}`)
}
process.env.BRAYNESS_STATE = join(base, "state")
await timed(`first sync, ${FILES} files`)
// Past the feed's 5-second look-back, as between real syncs.
await new Promise((done) => setTimeout(done, 6000))
await timed("no change")
await writeFile(join(harness, "notes/7/7.md"), "changed\n")
await timed("one file changed")
server.close()
if (process.env.BUCKET) {
  const { execFileSync } = await import("node:child_process")
  execFileSync("gcloud", ["storage", "rm", "-r", "--quiet", `gs://${process.env.BUCKET}/${prefix}`], { stdio: "ignore" })
  console.log(`removed gs://${process.env.BUCKET}/${prefix}`)
}
