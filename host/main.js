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
import { logger } from "./src/log.js"
import * as pty from "./src/pty.js"
import * as server from "./src/server.js"
import { ActorStore } from "./src/actors.js"
import { AppStore } from "./src/apps.js"
import * as webterm from "./src/webterm.js"

const LOG = logger("host")
const HERE = dirname(fileURLToPath(import.meta.url))
// Terminal writes never pass through exec; this bounds what a hard stop loses.
const FLUSH_MS = 5000
// How often to step idle actors down (h3).
const SWEEP_MS = 60_000
// How often to check each app's VM and port (u5).
const APP_SWEEP_MS = 5000

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
const listen = (what, port) =>
  new Promise((done) => what.listen(Number(port), values.listen, done))

await listen(pty.makeServer(store), values["pty-port"])
LOG.info(`pty stream on ${values.listen}:${values["pty-port"]}`)
await listen(webterm.makeServer({ pageRoot: values.term, streamPort: Number(values["pty-port"]), store, newActor: (owner) => store.create(owner) }), values["web-port"])
LOG.info(`browser terminal on ${values.listen}:${values["web-port"]}`)
new Door(store, process.env.BRAYNESS_SITE_URL ?? "/s/{id}/").start()
const apps = new AppStore({ volume: values.volume, image: values["app-image"], kernel: values.kernel, firecracker: values.firecracker })
await listen(server.makeServer(store, apps), values.port)
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
