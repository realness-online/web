#!/usr/bin/env node
/**
 * gsutil-style commands through the sync service.
 *
 *   brayness-store ls    can://~/vault/
 *   brayness-store cat   can://~/vault/note.md
 *   brayness-store cp    note.md can://~/vault/
 *   brayness-store cp    can://~/vault/note.md .
 *   brayness-store rm    can://~/vault/note.md
 *   brayness-store sync  ~/brayness/plans can://~/plans/   two-way
 *   brayness-store login | logout | whoami
 *
 * `login` signs in through Realness in your browser and keeps the result in
 * the macOS keychain; every other command then signs itself. TOKEN, when set,
 * wins. SYNC_URL picks the service; REALNESS_URL picks the sign-in site.
 */
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { client, phone_of, SyncError } from "../src/client.js"
import { keychain, login, token_source } from "../src/login.js"

const DEFAULT_URL = "https://brayness-sync-639469569733.us-central1.run.app"
// Development only for now: the sync service it talks to trusts dev sign-in.
// Both flip to production together.
const REALNESS = process.env.REALNESS_URL ?? "https://realness-development.web.app"
const [command, ...args] = process.argv.slice(2)
const signed_in = ["login", "logout"].includes(command) ? null : await token_source()()
const store = client({ url: process.env.SYNC_URL ?? DEFAULT_URL, token: signed_in })
const mask = (phone) => (phone ? `${phone.slice(0, 2)}…${phone.slice(-2)}` : "nobody")

const commands = {
  async login() {
    console.log(`Opening ${REALNESS}/sign-on in your browser. Click to sign Brayness in.`)
    const { id_token } = await login({ realness: REALNESS, open: (url) => promisify(execFile)("open", [url]) })
    console.log(`Signed in as ${mask(phone_of(id_token))}. The keychain holds it.`)
  },
  async logout() {
    await keychain.remove()
    console.log("Signed out; the keychain entry is gone.")
  },
  async whoami() {
    console.log(signed_in ? `Signed in as ${mask(phone_of(signed_in))}` : "Not signed in; run brayness-store login")
  },
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
  async sync([local, remote]) {
    const report = await store.sync(local, remote)
    for (const [kind, names] of Object.entries(report)) {
      if (names.length) console.log(`${kind}: ${names.length}${["conflicts", "kept_both"].includes(kind) ? `\n  ${names.join("\n  ")}` : ""}`)
    }
    if (report.conflicts.length) process.exitCode = 1
  },
}

if (!commands[command]) {
  console.error("usage: brayness-store login|logout|whoami|ls|cat|cp|rm|sync ... (see the header of this file)")
  process.exit(2)
}
try {
  await commands[command](args)
} catch (error) {
  const hint = { 401: "sign in again: TOKEN is missing, expired, or from another project", 403: "not yours to touch", 404: "not found" }
  console.error(error instanceof SyncError ? `${error.message}${hint[error.status] ? ` - ${hint[error.status]}` : ""}` : error.message)
  process.exit(1)
}
