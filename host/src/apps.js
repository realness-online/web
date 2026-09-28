// One app VM: a fresh boot of the stripped image (app-image-build.sh) with the
// app's code disk and, when its files ask, one runtime disk, both read-only.
// No vsock: the host's only ways in are port 8080 and the serial log.
//
// Layout under <volume>/apps/<id>/:
//   rootfs.ext4   a copy of app.ext4, the only writable disk
//   code.ext4     label app-code: code/ (the files) and argv (the start command)
//   app.json      the record; api.sock, firecracker.log (serial) beside it

import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { connect } from "node:net"
import { join } from "node:path"
import { BadRequest, HostError, NotFound } from "./errors.js"
import * as firecracker from "./firecracker.js"
import * as host from "./host.js"
import { APP_PORT, infer } from "./infer.js"
import { logger } from "./log.js"

const LOG = logger("apps")
const ROOT = "rootfs.ext4"
const CODE = "code.ext4"
const NET = "172.17"
const ID = /^app-[0-9a-f]{12}$/

// u2b. Every app gets exactly these until u2e measures the floor. The writable
// disk cap is the root copy's size: SIZE in app-image-build.sh (1G).
export const CAPS = { vcpus: 1, mib: 128 }

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const mintId = () => `app-${randomBytes(6).toString("hex")}`

/** fc-app5 -> 06:00:AC:11:05:02; the guest reads 172.17.5.2 off its MAC. */
export function macFor(tap) {
  const index = Number(/(\d+)$/.exec(tap)?.[1])
  if (!(index >= 1 && index <= 255)) throw new HostError(`no app index in TAP ${tap}`)
  return `06:00:AC:11:${index.toString(16).padStart(2, "0").toUpperCase()}:02`
}

/** The start command as brayness-app-start reads it: one argument per line. */
export function argvText(start) {
  if (!start?.length || start.some((arg) => !arg || /\n/.test(arg))) throw new BadRequest(`bad start command: ${JSON.stringify(start)}`)
  return `${start.join("\n")}\n`
}

/** A read-only ext4 of the files plus argv; everything readable by `app`, nothing writable. */
export function buildCodeDisk(files, disk, start, work) {
  const stage = join(work, "stage")
  rmSync(stage, { recursive: true, force: true })
  mkdirSync(stage)
  try {
    host.run(["cp", "-a", "--reflink=auto", `${files}/.`, join(stage, "code")])
    writeFileSync(join(stage, "argv"), argvText(start))
    host.run(["chown", "-R", "0:0", stage])
    host.run(["chmod", "-R", "a+rX,go-w", stage])
    const kib = Number(host.run(["du", "-sk", stage]).output.split(/\s/)[0])
    host.run(["truncate", "-s", `${Math.max(16 * 1024, Math.ceil(kib * 1.5) + 8 * 1024)}K`, disk])
    host.run(["mkfs.ext4", "-q", "-F", "-L", "app-code", "-d", stage, disk])
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}

function portOpen(address, port, ms = 1000) {
  return new Promise((done) => {
    const socket = connect({ host: address, port, timeout: ms })
    const finish = (open) => {
      socket.destroy()
      done(open)
    }
    socket.on("connect", () => finish(true))
    socket.on("timeout", () => finish(false))
    socket.on("error", () => finish(false))
  })
}

const tail = (path, lines = 20) => (existsSync(path) ? readFileSync(path, "utf8").trimEnd().split("\n").slice(-lines).join("\n") : "")

export class AppStore {
  constructor(options) {
    Object.assign(this, {
      image: "/opt/fc/app.ext4",
      runtimes: "/opt/fc/runtimes",
      tapPrefix: "fc-app",
      bootTimeout: 60,
      apiTimeout: 30,
      ...CAPS,
      ...options,
    })
    this.dir = join(this.volume, "apps")
    host.requireRoot("creating TAPs and Firecracker")
  }

  path(id, ...rest) {
    if (!ID.test(id ?? "")) throw new NotFound(String(id))
    return join(this.dir, id, ...rest)
  }

  record(id) {
    const file = this.path(id, "app.json")
    if (!existsSync(file)) throw new NotFound(id)
    return JSON.parse(readFileSync(file, "utf8"))
  }

  /** Infer, build, boot, and wait for the port. A site gets a record and no VM. */
  async start(files) {
    const needs = infer(files)
    const id = mintId()
    if (needs.kind === "site") return { id, kind: "site", files }
    const dir = this.path(id)
    const runtime = needs.runtime ? join(this.runtimes, `${needs.runtime}.ext4`) : null
    if (runtime && !existsSync(runtime)) throw new HostError(`no runtime disk ${runtime}: run runtime-build.sh`)
    mkdirSync(dir, { recursive: true })
    let tap = ""
    let pid = 0
    try {
      host.run(["cp", "--reflink=auto", "--sparse=always", this.image, join(dir, ROOT)])
      buildCodeDisk(files, join(dir, CODE), needs.start, dir)
      tap = host.freeTap(this.tapPrefix)
      host.createTap(tap, NET)
      const address = host.tapGuest(tap, NET)
      const apiSock = join(dir, "api.sock")
      const log = join(dir, "firecracker.log")
      const child = firecracker.spawn(this.firecracker, dir, apiSock, log)
      pid = child.pid
      child.unref() // the VM outlives whoever started it; u5 supervises
      await firecracker.waitForApiSocket(apiSock)
      const readOnly = { code: join(dir, CODE), ...(runtime && { runtime }) }
      await firecracker.boot(new firecracker.Api(apiSock, this.apiTimeout), {
        kernel: this.kernel, disk: join(dir, ROOT), tap, mac: macFor(tap), vcpus: this.vcpus, mib: this.mib, readOnly,
      })
      const record = { id, kind: needs.kind, runtime: needs.runtime, start: needs.start, tap, pid, address, port: APP_PORT, vcpus: this.vcpus, mib: this.mib, created: new Date().toISOString() }
      writeFileSync(join(dir, "app.json"), `${JSON.stringify(record, null, 2)}\n`)
      const deadline = Date.now() + this.bootTimeout * 1000
      while (!(await portOpen(address, APP_PORT))) {
        if (!firecracker.alive(pid)) throw new HostError(`app VM exited during boot:\n${tail(log)}`)
        if (Date.now() > deadline) throw new HostError(`nothing on ${address}:${APP_PORT} after ${this.bootTimeout}s:\n${tail(log)}`)
        await sleep(250)
      }
      LOG.info(`app ${id} (${needs.kind}) on ${address}:${APP_PORT}, tap ${tap}`)
      return record
    } catch (error) {
      await firecracker.terminate(pid)
      if (tap) host.deleteTap(tap)
      if (!process.env.BRAYNESS_KEEP_FAILED) rmSync(dir, { recursive: true, force: true })
      throw error
    }
  }

  /** Stop the VM, give back its TAP, and delete its disks. */
  async stop(id) {
    const { tap } = this.record(id)
    await firecracker.terminate(firecracker.pidForApiSock(this.path(id, "api.sock")))
    host.deleteTap(tap)
    rmSync(this.path(id), { recursive: true, force: true })
  }
}
