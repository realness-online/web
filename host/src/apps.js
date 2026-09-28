// One app VM: a fresh boot of the stripped image (app-image-build.sh) with the
// app's code disk and, when its files ask, one runtime disk, both read-only.
// No vsock: the host's only ways in are port 8080 and the serial log.
//
// Layout under <volume>/apps/<id>/:
//   rootfs.ext4   a copy of app.ext4, the only writable disk
//   code.ext4     label app-code: code/ (the files) and argv (the start command)
//   app.json      the record; api.sock, firecracker.log (serial) beside it

import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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

// Caps, sized by u2n (app-memory-floor.sh): a handler serves at 64 MiB with
// ~6 left; at 96 it has ~37 for its own work. A store's `mib` option overrides.
// The writable disk cap is the root copy's size: SIZE in app-image-build.sh.
export const CAPS = { vcpus: 1, mib: 96 }

/** Memory for an app: the store's override, else the cap. */
export const mibFor = (needs, override) => override ?? CAPS.mib

// u5. Closed-port sweeps before a restart; restarts per window before `crashed`.
const MISSES = 3
const CRASHES = 5
const CRASH_WINDOW = 10 * 60_000

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
      vcpus: CAPS.vcpus,
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

  /** Private is the default; public lets anyone with the id reach the app. */
  setPublic(id, open) {
    return this.serial(id, () => this.write({ ...this.record(id), public: open }))
  }

  /** Every stored record, oldest id first. */
  list() {
    if (!existsSync(this.dir)) return []
    return readdirSync(this.dir).filter((name) => ID.test(name) && existsSync(this.path(name, "app.json"))).sort().map((id) => this.record(id))
  }

  /** The record, plus whether its VM runs and its port answers. */
  async status(id) {
    const record = this.record(id)
    const running = firecracker.alive(firecracker.pidForApiSock(this.path(id, "api.sock")))
    return { ...record, running, answering: running && (await portOpen(record.address, record.port)) }
  }

  /** `copy(dest)` fills a staging folder; start runs from it, then it goes. */
  async startFrom(copy, meta) {
    mkdirSync(this.dir, { recursive: true })
    const stage = join(this.dir, `.stage-${randomBytes(6).toString("hex")}`)
    try {
      await copy(stage)
      return await this.start(stage, meta)
    } finally {
      rmSync(stage, { recursive: true, force: true })
    }
  }

  write(record) {
    writeFileSync(this.path(record.id, "app.json"), `${JSON.stringify(record, null, 2)}\n`)
    return record
  }

  /** One operation per app at a time: the sweep and the API never race. */
  serial(id, work) {
    this.queues ??= new Map()
    const next = (this.queues.get(id) ?? Promise.resolve()).then(work, work)
    this.queues.set(id, next.catch(() => {}))
    return next
  }

  /** Infer, build, boot, and wait for the port. A site gets a record and no VM. */
  async start(files, meta = {}) {
    const needs = infer(files)
    const id = mintId()
    if (needs.kind === "site") return { id, kind: "site", ...meta }
    const runtime = needs.runtime ? join(this.runtimes, `${needs.runtime}.ext4`) : null
    if (runtime && !existsSync(runtime)) throw new HostError(`no runtime disk ${runtime}: run runtime-build.sh`)
    const dir = this.path(id)
    mkdirSync(dir, { recursive: true })
    let tap = ""
    try {
      buildCodeDisk(files, join(dir, CODE), needs.start, dir)
      tap = host.freeTap(this.tapPrefix)
      host.createTap(tap, NET)
      this.write({ id, ...meta, kind: needs.kind, runtime: needs.runtime, start: needs.start, tap, pid: 0, address: host.tapGuest(tap, NET), port: APP_PORT, vcpus: this.vcpus, mib: mibFor(needs, this.mib), created: new Date().toISOString() })
      return await this.serial(id, () => this.boot(id))
    } catch (error) {
      await firecracker.terminate(firecracker.pidForApiSock(join(dir, "api.sock")))
      if (tap) host.deleteTap(tap)
      if (!process.env.BRAYNESS_KEEP_FAILED) rmSync(dir, { recursive: true, force: true })
      throw error
    }
  }

  /**
   * A fresh boot from the record: a new copy of the image, the same code disk,
   * TAP, MAC, and address. Any VM still on the api socket goes first.
   */
  async boot(id) {
    const record = this.record(id)
    const dir = this.path(id)
    const apiSock = join(dir, "api.sock")
    const log = join(dir, "firecracker.log")
    await firecracker.terminate(firecracker.pidForApiSock(apiSock))
    rmSync(apiSock, { force: true })
    if (!host.tapExists(record.tap)) host.createTap(record.tap, NET)
    host.run(["cp", "--reflink=auto", "--sparse=always", this.image, join(dir, ROOT)])
    const runtime = record.runtime ? join(this.runtimes, `${record.runtime}.ext4`) : null
    const child = firecracker.spawn(this.firecracker, dir, apiSock, log)
    child.unref() // the VM outlives whoever started it; the sweep supervises
    await firecracker.waitForApiSocket(apiSock)
    await firecracker.boot(new firecracker.Api(apiSock, this.apiTimeout), {
      kernel: this.kernel, disk: join(dir, ROOT), tap: record.tap, mac: macFor(record.tap), vcpus: record.vcpus, mib: record.mib,
      readOnly: { code: join(dir, CODE), ...(runtime && { runtime }) },
    })
    const deadline = Date.now() + this.bootTimeout * 1000
    while (!(await portOpen(record.address, record.port))) {
      if (!firecracker.alive(child.pid)) throw new HostError(`app VM exited during boot:\n${tail(log)}`)
      if (Date.now() > deadline) throw new HostError(`nothing on ${record.address}:${record.port} after ${this.bootTimeout}s:\n${tail(log)}`)
      await sleep(250)
    }
    LOG.info(`app ${id} (${record.kind}) on ${record.address}:${record.port}, tap ${record.tap}`)
    return this.write({ ...record, pid: child.pid, booted: new Date().toISOString() })
  }

  /**
   * u5: one pass over every app. A dead VM, or a port closed MISSES sweeps
   * running, gets a fresh boot. CRASHES restarts inside CRASH_WINDOW mark
   * the app `crashed` and stop it; its files stay for the owner to read.
   */
  async sweep(now = Date.now()) {
    this.misses ??= new Map()
    const done = []
    for (const { id, kind, state, booted } of this.list()) {
      if (kind === "site" || state === "crashed" || !booted) continue
      const step = await this.serial(id, () => this.check(id, now)).catch((error) => `failed: ${error.message.split("\n")[0]}`)
      if (step) done.push({ id, step })
    }
    return done
  }

  async check(id, now) {
    if (!existsSync(this.path(id, "app.json"))) return null // stopped while queued
    const record = this.record(id)
    const running = firecracker.alive(firecracker.pidForApiSock(this.path(id, "api.sock")))
    if (running && (await portOpen(record.address, record.port))) {
      this.misses.delete(id)
      return null
    }
    const misses = (this.misses.get(id) ?? 0) + 1
    this.misses.set(id, misses)
    if (running && misses < MISSES) return null
    const restarts = (record.restarts ?? []).filter((at) => now - Date.parse(at) < CRASH_WINDOW)
    if (restarts.length >= CRASHES) {
      await firecracker.terminate(firecracker.pidForApiSock(this.path(id, "api.sock")))
      this.write({ ...record, state: "crashed", restarts, reason: tail(this.path(id, "firecracker.log"), 5) })
      this.misses.delete(id)
      return "crashed"
    }
    // Back off: 0s, 2s, 4s, 8s ... after the last restart.
    const last = restarts.length ? Date.parse(restarts.at(-1)) : 0
    if (now - last < (restarts.length ? 1000 * 2 ** restarts.length : 0)) return null
    this.write({ ...record, restarts: [...restarts, new Date(now).toISOString()] })
    this.misses.delete(id)
    await this.boot(id)
    return running ? "restarted: port closed" : "restarted: VM gone"
  }

  /** Stop the VM, give back its TAP, and delete its disks. */
  stop(id) {
    return this.serial(id, async () => {
      const { tap } = this.record(id)
      await firecracker.terminate(firecracker.pidForApiSock(this.path(id, "api.sock")))
      host.deleteTap(tap)
      rmSync(this.path(id), { recursive: true, force: true })
    })
  }
}
