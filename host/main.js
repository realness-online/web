#!/usr/bin/env node
// The actor host.
//
//   sudo node host/main.js serve --volume /opt/fc/actors/mnt
//   sudo node host/main.js seed  --volume /opt/fc/actors/mnt --rebuild
//
// `serve` builds the seed if none matches, then answers: the API on --port,
// the framed terminal on --pty-port, the browser terminal on --web-port, and
// the door for each running actor. `seed` stops after building it.

import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { Door } from "./src/door.js"
import { Loops } from "./src/loops.js"
import { HostStatus } from "./src/status.js"
import { ActorRequests } from "./src/requests.js"
import { SyncSites } from "./src/sync-sites.js"
import { hostname } from "node:os"
import { readFileSync } from "node:fs"
import { SyncMirror } from "./src/sync-mirror.js"
import { logger } from "./src/log.js"
import * as pty from "./src/pty.js"
import * as server from "./src/server.js"
import { ActorStore } from "./src/actors.js"
import { AppStore } from "./src/apps.js"
import * as webterm from "./src/webterm.js"
import { issue_model_pass } from "../proxy/src/model-pass.js"

const LOG = logger("host")
const HERE = dirname(fileURLToPath(import.meta.url))
// Terminal writes never pass through exec; this bounds what a hard stop loses.
const FLUSH_MS = 5000
// How often to step idle actors down (h3).
const SWEEP_MS = 60_000
// How often to check each app's VM and port (u5).
const APP_SWEEP_MS = 5000
// How often to write this host's status to Storage (o1).
const STATUS_MS = 30_000

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    volume: { type: "string", default: "/opt/fc/actors/mnt" },
    template: { type: "string", default: "/opt/fc/template.ext4" },
    "app-image": { type: "string", default: "/opt/fc/app.ext4" },
    kernel: { type: "string", default: "/opt/fc/vmlinux-6.1.155" },
    firecracker: { type: "string", default: "/opt/fc/firecracker" },
    "guest-mac": { type: "string", default: "06:00:AC:10:00:02" },
    "guest-cid": { type: "string", default: "3" },
    "vsock-port": { type: "string", default: "52" },
    vcpu: { type: "string", default: "2" },
    "mem-mib": { type: "string", default: "512" },
    "tap-prefix": { type: "string", default: "fc-tap" },
    "seed-tap": { type: "string", default: "fc-tap0" },
    "boot-timeout": { type: "string", default: "60" },
    "api-timeout": { type: "string", default: "30" },
    listen: { type: "string", default: "0.0.0.0" },
    port: { type: "string", default: "8080" },
    "pty-port": { type: "string", default: "8081" },
    "web-port": { type: "string", default: "8090" },
    term: { type: "string", default: join(HERE, "term") },
    chat: { type: "string", default: join(HERE, "chat") },
    rebuild: { type: "boolean", default: false },
  },
})

const command = positionals[0]
if (command !== "serve" && command !== "seed") {
  console.error("usage: main.js serve|seed [--volume PATH] ...")
  process.exit(2)
}

const store = new ActorStore({
  volume: values.volume,
  template: values.template,
  kernel: values.kernel,
  firecracker: values.firecracker,
  guestMac: values["guest-mac"],
  guestCid: Number(values["guest-cid"]),
  vsockPort: Number(values["vsock-port"]),
  vcpus: Number(values.vcpu),
  mib: Number(values["mem-mib"]),
  tapPrefix: values["tap-prefix"],
  seedTap: values["seed-tap"],
  bootTimeout: Number(values["boot-timeout"]),
  apiTimeout: Number(values["api-timeout"]),
})
const warning = store.reflinkWarning()
if (warning) LOG.warn(warning)

if (command === "seed") {
  const status = await store.ensureSeed({ rebuild: values.rebuild })
  LOG.info(`seed ready: ${JSON.stringify(status.record)}`)
  process.exit(0)
}

await store.ensureSeed()
if (process.env.SYNC_SITE_URL) store.syncSites = new SyncSites({ url: process.env.SYNC_SITE_URL, secret: process.env.HOST_PASS_SECRET })
const listen = (what, port) =>
  new Promise((done) => what.listen(Number(port), values.listen, done))

await listen(pty.makeServer(store), values["pty-port"])
LOG.info(`pty stream on ${values.listen}:${values["pty-port"]}`)
// b1c: the owner's limit status from the proxy, under the actor's model pass.
const proxy_url = (process.env.BRAYNESS_PROXY_URL ?? "https://brayness-proxy-yelzvhhngq-uc.a.run.app").replace(/\/$/, "")
const limits = process.env.MODEL_PASS_SECRET
  ? async (record) => {
      const pass = issue_model_pass({ phone: record.owner, id: record.id }, process.env.MODEL_PASS_SECRET)
      const reply = await fetch(`${proxy_url}/limit`, { headers: { authorization: `Bearer ${pass}` }, signal: AbortSignal.timeout(5000) })
      if (!reply.ok) throw new Error(`proxy /limit ${reply.status}`)
      return reply.json()
    }
  : null
await listen(webterm.makeServer({ pageRoot: values.term, chatRoot: values.chat, streamPort: Number(values["pty-port"]), store, newActor: (owner) => store.create(owner), limits }), values["web-port"])
LOG.info(`browser terminal on ${values.listen}:${values["web-port"]}`)
// The host signs record passes; sync alone holds the Storage key.
const mirror = process.env.SYNC_URL ? new SyncMirror({ url: process.env.SYNC_URL, secret: readFileSync(process.env.RECORD_SECRET_FILE, "utf8").trim(), host: hostname() }) : null
const loops = new Loops(store, { mirror })
const site_url = store.syncSites ? `${(process.env.SYNC_SITE_PUBLIC_URL ?? process.env.SYNC_SITE_URL).replace(/\/$/, "")}/sites/{id}/` : "/s/{id}/"
new Door(store, process.env.BRAYNESS_SITE_URL ?? site_url, loops).start()
const apps = new AppStore({ volume: values.volume, image: values["app-image"], kernel: values.kernel, firecracker: values.firecracker })
await listen(server.makeServer(store, apps, undefined, loops), values.port)
LOG.info(`listening on ${values.listen}:${values.port}`)

const sweep = async () => {
  try {
    const done = await store.sweep()
    for (const { id, step } of done) LOG.info(`lifecycle: ${id} -> ${step}`)
  } catch (error) {
    LOG.warn(`idle sweep failed: ${error.message}`)
  }
  setTimeout(sweep, SWEEP_MS)
}

const flush = async () => {
  try {
    await store.flushAll()
  } catch (error) {
    LOG.warn(`flush failed: ${error.message}`)
  }
  setTimeout(flush, FLUSH_MS)
}
setTimeout(flush, FLUSH_MS)
setTimeout(sweep, SWEEP_MS)

// u5: the first pass runs now, so a host restart brings its apps back.
const superviseApps = async () => {
  try {
    for (const { id, step } of await apps.sweep()) LOG.info(`app: ${id} -> ${step}`)
  } catch (error) {
    LOG.warn(`app sweep failed: ${error.message}`)
  }
  setTimeout(superviseApps, APP_SWEEP_MS)
}
superviseApps()

// o1: the first record now, so a restarted host shows at once.
const status = new HostStatus(store, { mirror, apps, loops, warn: (message) => LOG.warn(message) })
// o6: admin idle and stop requests, obeyed before the record is written.
const requests = new ActorRequests(store, { mirror, host: hostname(), warn: (message) => LOG.warn(message) })
const report = async () => {
  for (const { id, action } of await requests.obey()) LOG.info(`admin request: ${action} ${id}`)
  await status.publish()
  setTimeout(report, STATUS_MS)
}
if (mirror) report()
