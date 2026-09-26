#!/usr/bin/env node
/**
 * gsutil-style commands through the sync service.
 *
 *   brayness-store ls    can://~/vault/
 *   brayness-store cat   can://~/vault/note.md
 *   brayness-store cp    note.md can://~/vault/
 *   brayness-store cp    can://~/vault/note.md .
 *   brayness-store rm    can://~/vault/note.md
 *   brayness-store rsync ~/brayness/plans can://~/plans/
 *
 * TOKEN is a Realness sign-in token; public reads work without one.
 * SYNC_URL picks the service (default: the realness-development deploy).
 */
import { client, SyncError } from "../src/client.js"

const DEFAULT_URL = "https://brayness-sync-639469569733.us-central1.run.app"
const [command, ...args] = process.argv.slice(2)
const store = client({ url: process.env.SYNC_URL ?? DEFAULT_URL, token: process.env.TOKEN })

const commands = {
  async ls([path = "can://~/"]) {
    for (const name of await store.ls(path)) console.log(name)
  },
  async cat([path]) {
    process.stdout.write(await store.cat(path))
  },
  async cp([from, to]) {
    console.log(await store.cp(from, to))
  },
  async rm(paths) {
    for (const path of paths) await store.rm(path)
  },
  async rsync([local, remote]) {
    const report = await store.rsync(local, remote)
    for (const [kind, names] of Object.entries(report)) {
      if (names.length) console.log(`${kind}: ${names.length}${kind === "conflicts" ? `\n  ${names.join("\n  ")}` : ""}`)
    }
    if (report.conflicts.length) process.exitCode = 1
  },
}

if (!commands[command]) {
  console.error("usage: brayness-store ls|cat|cp|rm|rsync ... (see the header of this file)")
  process.exit(2)
}
try {
  await commands[command](args)
} catch (error) {
  const hint = { 401: "sign in again: TOKEN is missing, expired, or from another project", 403: "not yours to touch", 404: "not found" }
  console.error(error instanceof SyncError ? `${error.message}${hint[error.status] ? ` - ${hint[error.status]}` : ""}` : error.message)
  process.exit(1)
}
