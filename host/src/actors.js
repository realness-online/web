// The seed, and an actor's life: create, idle, reload, destroy, publish,
// export, restore. Commentary on why lives in README.md (f4-f6, r3-r7).
//
// Nothing half-built is left in the volume: a failed create or restore rolls
// back everything it took, because a leftover TAP or process is invisible in a
// list of actors.

import { createHash, randomBytes } from "node:crypto"
import { writeFileDurable } from "./durable.js"
import { createReadStream, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync, appendFileSync } from "node:fs"
import { arch } from "node:os"
import { basename, join } from "node:path"
import { BadRequest, Busy, HostError, NotFound, VsockError } from "./errors.js"
import * as firecracker from "./firecracker.js"
import * as host from "./host.js"
import { logger } from "./log.js"
import * as vsock from "./vsock.js"
import { next_step } from "./lifecycle.js"

const LOG = logger("actors")

const DISK = "rootfs.ext4"
const STATE = "state"
const MEM = "mem"
const ACTOR_INIT = "/usr/local/bin/brayness-actor-init"
export const PTY_PORT = 53
const PI_OPENER = Buffer.from("exec brayness\r")
const PI_PROMPT = "inkling"
const PI_WARM_SECONDS = 300
const FINGERPRINT_SCHEMA = 1
// Size and mtime decide staleness; the sha256 is recorded, never re-hashed at start.
const CHEAP_FIELDS = ["schema", "arch", "kernel", "firecracker", "template_size", "template_mtime_ns", "vcpu_count"]
// An export carries /brayness (the harness and its work/); identity in /etc stays behind.
const ARTIFACT_PATHS = ["brayness"]
const TRACES = "traces"
const EXPORTS = "exports"
const PUBLISHED = "published"
const VERSIONS = "published-versions"
const NON_ACTOR_DIRS = new Set(["seed", "apps", TRACES, EXPORTS, PUBLISHED, VERSIONS])
// Ids are names on the volume; anything else would be a path.
const ID = /^[A-Za-z0-9][A-Za-z0-9-]*$/

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
export const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, "+00:00")
const mintId = () => `a-${randomBytes(6).toString("hex")}`
const writeJson = (path, value) => writeFileDurable(path, `${JSON.stringify(value, null, 2)}\n`)
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"))
const unlink = (path) => rmSync(path, { force: true })
const machine = () => ({ arm64: "aarch64", x64: "x86_64" })[arch()] ?? arch()

function sha256File(path) {
  return new Promise((done, fail) => {
    const hash = createHash("sha256")
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => done(hash.digest("hex")))
      .on("error", fail)
  })
}

export class Actor {
  constructor(fields) {
    Object.assign(this, { machine_id: "", hostname: "", boot_id: "", state: "running", owner: null, paths: null, last_activity: "" }, fields)
    this.apiSock = join(this.dir, "api.sock")
    this.vsockPath = join(this.dir, "vsock.sock")
  }

  toJSON() {
    const { id, state, created, tap, pid, hostname, machine_id, boot_id, dir, owner, paths, last_activity } = this
    return { id, state, created, tap, pid, hostname, machine_id, boot_id, dir, owner, paths, last_activity }
  }
}

/** One lock for everything that changes an actor; exec and reads stay outside it. */
class Mutex {
  #tail = Promise.resolve()
  run(work) {
    const result = this.#tail.then(work)
    this.#tail = result.catch(() => {})
    return result
  }
}

/**
 * Start Pi in the seed's terminal and wait until a typed key echoes, so every
 * clone opens on a ready Pi. Every key typed is erased so the editor starts
 * empty: a slow Pi gets more than one before the first echoes.
 */
async function warmPi(uds, seconds = PI_WARM_SECONDS) {
  const { socket, lines } = await vsock.connect(uds, PTY_PORT)
  const send = (data) => socket.write(`${JSON.stringify({ op: "data", data_b64: data.toString("base64") })}\n`)
  const started = Date.now()
  let opened = false
  let prompt = false
  let lastKey = 0
  let keys = 0
  let seen = ""
  try {
    socket.write(`${JSON.stringify({ op: "resize", cols: 80, rows: 24 })}\n`)
    while (Date.now() - started < seconds * 1000) {
      let line = null
      try {
        line = await lines.read(1)
      } catch {}
      if (line === null && lines.closed) throw new VsockError("the seed's terminal closed while warming pi")
      if (line?.length) {
        const message = JSON.parse(line)
        if (message.op === "exit") throw new VsockError(`pi exited while warming: ${line}`)
        const chunk = Buffer.from(message.data_b64 ?? "", "base64").toString("latin1")
        if (!opened) {
          if (chunk.includes("# ")) {
            send(PI_OPENER)
            opened = true
          }
        } else if (!prompt) {
          seen += chunk
          prompt = seen.includes(PI_PROMPT)
        } else if (lastKey && chunk.includes("q") && chunk.includes("\x1b[2K")) {
          send(Buffer.from("\x7f".repeat(keys)))
          await sleep(1000)
          LOG.info(`pi warm in the seed after ${((Date.now() - started) / 1000).toFixed(1)}s`)
          return
        }
      }
      // A shell prompt drawn before the attach is dropped; open anyway.
      if (!opened && Date.now() - started > 3000) {
        send(PI_OPENER)
        opened = true
      }
      if (prompt && Date.now() - lastKey > 1000) {
        send(Buffer.from("q"))
        keys++
        lastKey = Date.now()
      }
    }
    throw new VsockError(`pi did not echo a key within ${seconds}s`)
  } finally {
    socket.destroy()
  }
}

export class ActorStore {
  constructor(options) {
    Object.assign(this, {
      guestCid: 3,
      vsockPort: vsock.VSOCK_PORT,
      vcpus: 2,
      mib: 512,
      tapPrefix: "fc-tap",
      seedTap: "fc-tap0",
      bootTimeout: 60,
      apiTimeout: 30,
      ...options,
    })
    this.seedDir = join(this.volume, "seed")
    this.tracesDir = join(this.volume, TRACES)
    this.exportsDir = join(this.volume, EXPORTS)
    this.publishedDir = join(this.volume, PUBLISHED)
    this.versionsDir = join(this.volume, VERSIONS)
    this.lock = new Mutex()
    this.busy = new Set()
    this.firecrackerVersion = firecracker.version(this.firecracker)
    host.requireRoot("creating TAPs and Firecracker")
    host.requireMount(this.volume, "mount the actors volume (the dev stack script)")
    if (!host.shortEnoughForUnix(join(this.volume, mintId(), "vsock.sock"))) {
      throw new HostError(`${this.volume} is too long for AF_UNIX socket paths (108 bytes); mount the actors volume somewhere shorter`)
    }
  }

  reflinkWarning() {
    return host.reflinkWarning(this.volume)
  }

  // ---------------------------------------------------------------- seed
  cheapFingerprint() {
    const stat = statSync(this.template, { bigint: true })
    return {
      schema: FINGERPRINT_SCHEMA,
      arch: machine(),
      kernel: basename(this.kernel),
      firecracker: this.firecrackerVersion,
      template_size: Number(stat.size),
      template_mtime_ns: Number(stat.mtimeNs),
      vcpu_count: this.vcpus,
    }
  }

  /** Whether a seed exists and matches the build; a stale seed forks quietly, so say so. */
  seedStatus() {
    const status = { built: false, matches: false, mismatches: [], record: null }
    const recordPath = join(this.seedDir, "seed.json")
    if (!existsSync(recordPath) || !existsSync(join(this.seedDir, STATE))) return status
    const record = readJson(recordPath)
    const current = this.cheapFingerprint()
    status.built = true
    status.record = record
    for (const key of CHEAP_FIELDS) {
      // Python wrote mtime_ns as an exact integer; a double may round it.
      const same = key === "template_mtime_ns" ? Math.abs(record[key] - current[key]) < 1000 : record[key] === current[key]
      if (!same) status.mismatches.push(`${key}: ${record[key]} != ${current[key]}`)
    }
    status.matches = status.mismatches.length === 0
    return status
  }

  async ensureSeed({ rebuild = false } = {}) {
    const status = this.seedStatus()
    if (status.matches && !rebuild) return status
    if (rebuild && this.liveActors().length) throw new Busy("actors are running from this seed; destroy them before --rebuild")
    await this.buildSeed(status)
    return this.seedStatus()
  }

  /** Boot the template once, warm Pi, snapshot, stop (f4, f6). */
  async buildSeed(status = this.seedStatus()) {
    const target = this.seedDir
    if (status.built) LOG.warn(`seed does not match the current build: ${status.mismatches.join("; ")}`)
    LOG.info(`building the seed from ${this.template}`)
    rmSync(target, { recursive: true, force: true })
    mkdirSync(target, { recursive: true })
    host.run(["cp", "--sparse=always", this.template, join(target, DISK)])
    if (!host.tapExists(this.seedTap)) throw new HostError(`no ${this.seedTap}: run 'sudo bash host/scripts/net-up.sh' first`)

    const apiSock = join(target, "api.sock")
    const uds = join(target, "vsock.sock")
    unlink(apiSock)
    unlink(uds)
    LOG.info("booting the template")
    const child = firecracker.spawn(this.firecracker, target, apiSock, join(target, "firecracker.log"))
    let identity
    try {
      await firecracker.waitForApiSocket(apiSock)
      const api = new firecracker.Api(apiSock, this.apiTimeout)
      await firecracker.boot(api, { kernel: this.kernel, disk: DISK, tap: this.seedTap, uds, mac: this.guestMac, cid: this.guestCid, vcpus: this.vcpus, mib: this.mib })
      await vsock.waitForAgent(uds, this.bootTimeout, this.vsockPort)
      await vsock.execInGuest(uds, ["/bin/sh", "-c", "logger -t brayness-seed 'seed boot marker'; touch /tmp/brayness-seed-marker; sync"], { timeout: this.apiTimeout, port: this.vsockPort })
      identity = await this.identity(uds)
      LOG.info(`seed is up: hostname ${identity.hostname}`)
      await warmPi(uds)
      LOG.info("pausing and snapshotting")
      await firecracker.pause(api)
      await firecracker.createSnapshot(api, join(target, STATE), join(target, MEM))
    } finally {
      await firecracker.terminate(child.pid)
    }
    const record = {
      ...this.cheapFingerprint(),
      template_sha256: await sha256File(this.template),
      created: nowIso(),
      machine_id: identity.machine_id,
      boot_id: identity.boot_id,
    }
    writeJson(join(target, "seed.json"), record)
    LOG.info(`seed built: ${target}`)
    return record
  }

  seedFingerprint() {
    const record = this.seedStatus().record ?? {}
    return Object.fromEntries([...CHEAP_FIELDS, "template_sha256"].map((key) => [key, record[key] ?? null]))
  }

  // ------------------------------------------------------------ actors
  create(owner, { paths = null } = {}) {
    return this.lock.run(() => this.#create(owner, { paths }))
  }

  async #create(owner, { paths = null } = {}) {
    if (!/^\+[1-9]\d{6,14}$/.test(owner)) throw new BadRequest("verified owner required")
    const seed = await this.ensureSeed()
    if (!seed.matches) throw new Busy(`seed does not match the current build: ${seed.mismatches.join("; ")}`)
    const id = mintId()
    const record = new Actor({ id, created: nowIso(), tap: "", pid: 0, dir: join(this.volume, id), owner, paths, last_activity: nowIso() })
    try {
      mkdirSync(record.dir, { recursive: true })
      this.#reflinkSeedDisk(record.dir)
      record.tap = host.freeTap(this.tapPrefix)
      host.createTap(record.tap)
      await this.#start(record, join(this.seedDir, STATE), join(this.seedDir, MEM))
      Object.assign(record, await this.#initActor(record))
      this.#write(record)
      this.trace(record.id, "create", { hostname: record.hostname, machine_id: record.machine_id, tap: record.tap, pid: record.pid })
    } catch (error) {
      LOG.warn(`create failed for ${id}, rolling back`)
      await this.#teardown(record)
      throw error
    }
    LOG.info(`actor ${record.id} running (tap ${record.tap}, pid ${record.pid})`)
    return record
  }

  #reflinkSeedDisk(dir) {
    const source = join(this.seedDir, DISK)
    try {
      host.run(["cp", "--reflink=always", source, join(dir, DISK)])
    } catch (error) {
      throw new HostError(`reflink failed: ${error.message}\nactor disks are reflinks of ${source}, which needs xfs (or btrfs) at ${this.volume}`)
    }
  }

  /** Load a snapshot as this actor: its TAP, its vsock, and (from cwd) its disk. */
  async #start(record, state, mem) {
    // A terminated process leaves its sockets; Firecracker cannot bind over them.
    unlink(record.apiSock)
    unlink(record.vsockPath)
    const child = firecracker.spawn(this.firecracker, record.dir, record.apiSock, join(record.dir, "firecracker.log"))
    record.pid = child.pid
    try {
      await firecracker.waitForApiSocket(record.apiSock)
      const api = new firecracker.Api(record.apiSock, this.apiTimeout)
      await firecracker.loadSnapshot(api, state, mem, record.tap, record.vsockPath)
      await vsock.waitForAgent(record.vsockPath, this.bootTimeout, this.vsockPort)
    } catch (error) {
      await firecracker.terminate(record.pid)
      throw error
    }
  }

  /** Cold tier: boot the actor's own disk; the seed's memory would see a stale /brayness. */
  async #bootActor(record) {
    unlink(record.apiSock)
    unlink(record.vsockPath)
    const child = firecracker.spawn(this.firecracker, record.dir, record.apiSock, join(record.dir, "firecracker.log"))
    record.pid = child.pid
    try {
      await firecracker.waitForApiSocket(record.apiSock)
      const api = new firecracker.Api(record.apiSock, this.apiTimeout)
      await firecracker.boot(api, { kernel: this.kernel, disk: DISK, tap: record.tap, uds: record.vsockPath, mac: this.guestMac, cid: this.guestCid, vcpus: this.vcpus, mib: this.mib })
      await vsock.waitForAgent(record.vsockPath, this.bootTimeout, this.vsockPort)
    } catch (error) {
      await firecracker.terminate(record.pid)
      throw error
    }
  }

  /** Turn the resumed clone into this actor (f6): clock, identity, address. */
  async #initActor(record) {
    const argv = [ACTOR_INIT, record.id, String(Math.floor(Date.now() / 1000)), `${host.tapGuest(record.tap)}/30`]
    const { code, out, err } = await vsock.execInGuest(record.vsockPath, argv, { timeout: this.bootTimeout, port: this.vsockPort })
    if (code !== 0) throw new VsockError(`actor-init on ${record.id} exited ${code}: ${err.toString().trim()}`)
    LOG.info(`actor ${record.id} initialized: ${out.toString().trim()}`)
    const { machine_id, hostname, boot_id } = await this.identity(record.vsockPath)
    return { machine_id, hostname, boot_id }
  }

  async identity(uds) {
    const output = await vsock.runOk(uds, ["/bin/sh", "-c", 'printf "%s %s %s %s\\n" "$(cat /etc/machine-id)" "$(hostname)" "$(cat /proc/sys/kernel/random/boot_id)" "$(date +%s)"'], { timeout: this.apiTimeout, port: this.vsockPort })
    const [machine_id, hostname, boot_id, clock] = output.trim().split(/\s+/)
    return { machine_id, hostname, boot_id, clock: Number(clock) }
  }

  /**
   * Run argv in one actor; no shell, so nothing in argv is parsed. The guest
   * is flushed before answering: a hard stop after an exec returned must not
   * lose what it wrote (h3).
   */
  async exec(id, argv, { cwd = null, stdin = Buffer.alloc(0), timeout = null } = {}) {
    if (!Array.isArray(argv) || !argv.length || !argv.every((item) => typeof item === "string" && item)) {
      throw new BadRequest("argv must be a non-empty list of strings")
    }
    if (cwd !== null && typeof cwd !== "string") throw new BadRequest("cwd must be a string")
    const record = await this.ensureRunning(id)
    const started = Date.now()
    this.beginWork(id)
    try {
      const { code, out, err } = await vsock.execInGuest(record.vsockPath, argv, { cwd, stdin, timeout: timeout || this.apiTimeout, port: this.vsockPort })
      await this.#flush(record)
      this.trace(record.id, "exec", { argv, cwd, exit_code: code, ms: Date.now() - started, stdout_bytes: out.length, stderr_bytes: err.length })
      return { exit_code: code, stdout_b64: out.toString("base64"), stderr_b64: err.toString("base64") }
    } finally {
      this.endWork(id)
    }
  }

  /** Guest page cache to its disk. A memory snapshot keeps it; a crash or cold boot does not. */
  async #flush(record) {
    try {
      await vsock.runOk(record.vsockPath, ["/bin/sync"], { timeout: this.apiTimeout, port: this.vsockPort })
      return true
    } catch (error) {
      LOG.warn(`actor ${record.id} did not sync: ${error.message}`)
      return false
    }
  }

  /** Flush every running actor: bounds what a hard stop loses from terminal writes. */
  async flushAll() {
    await Promise.all(this.liveActors().map((record) => this.#flush(record)))
  }

  ensureRunning(id) {
    const record = this.get(id)
    if (record.state === "running") return record
    return this.reload(id)
  }

  /** Mark an actor as doing work, so the idle sweep leaves it alone. */
  beginWork(id) {
    this.busy.add(id)
  }

  endWork(id) {
    this.busy.delete(id)
    this.touch(id).catch(() => {})
  }

  /** Record activity, writing at most once a minute. */
  touch(id) {
    return this.lock.run(() => {
      const record = this.get(id)
      const last = Date.parse(record.last_activity)
      if (Number.isFinite(last) && Date.now() - last < 60_000) return record
      record.last_activity = nowIso()
      this.#write(record)
      return record
    })
  }

  /**
   * Step idle actors down: memory, disk, export, then delete after a verified
   * export. Only verified owners are retired (lifecycle.next_step).
   */
  sweep({ now = Date.now(), apply = null } = {}) {
    return this.lock.run(async () => {
      const done = []
      for (const record of this.list()) {
        if (this.busy.has(record.id)) continue
        const step = next_step(record, now)
        if (!step) continue
        if (apply) {
          await apply(record, step)
        } else if (step === "export") {
          await this.#export(record.id)
          if (!this.#exportVerified(record.id)) {
            LOG.warn(`actor ${record.id} exported but not verified; keeping it`)
            continue
          }
          await this.#destroy(record.id)
        } else {
          await this.#idle(record.id, step)
        }
        done.push({ id: record.id, step })
      }
      return done
    })
  }

  /** An export is safe to retire when its manifest and bundle agree. */
  #exportVerified(id) {
    const dir = join(this.exportsDir, id)
    if (!existsSync(join(dir, "manifest.json"))) return false
    const manifest = readJson(join(dir, "manifest.json"))
    const artifacts = join(dir, manifest.artifacts?.path ?? "artifacts.tar.gz")
    return existsSync(artifacts) && statSync(artifacts).size === manifest.artifacts?.bytes
  }

  /** `memory` snapshots the actor; `disk` keeps only the disk. Idempotent. */
  idle(id, tier = "memory") {
    return this.lock.run(() => this.#idle(id, tier))
  }

  async #idle(id, tier) {
    if (tier !== "memory" && tier !== "disk") throw new BadRequest(`unknown idle tier '${tier}'; expected memory or disk`)
    const record = this.get(id)
    if (record.state === "running") {
      const pid = firecracker.pidForApiSock(record.apiSock) ?? record.pid
      await this.#flush(record)
      const api = new firecracker.Api(record.apiSock, this.apiTimeout)
      await firecracker.pause(api)
      if (tier === "memory") await firecracker.createSnapshot(api, join(record.dir, STATE), join(record.dir, MEM))
      await firecracker.terminate(pid)
    }
    if (tier === "disk") {
      unlink(join(record.dir, STATE))
      unlink(join(record.dir, MEM))
    }
    this.trace(id, "idle", { tier })
    LOG.info(`actor ${id} idle (${tier} tier)`)
    return this.get(id)
  }

  /** A memory snapshot is a restore; without one the actor's own disk boots. */
  reload(id) {
    return this.lock.run(() => this.#reload(id))
  }

  async #reload(id) {
    const record = this.get(id)
    if (record.state === "running") return record
    const state = join(record.dir, STATE)
    const mem = join(record.dir, MEM)
    const fromMemory = existsSync(state) && existsSync(mem)
    if (fromMemory) {
      LOG.info(`reloading actor ${id} from its memory snapshot`)
      await this.#start(record, state, mem)
    } else {
      LOG.info(`booting actor ${id} from its disk`)
      await this.#bootActor(record)
    }
    Object.assign(record, await this.#initActor(record))
    this.#write(record)
    this.trace(id, "reload", { from_memory: fromMemory, machine_id: record.machine_id, hostname: record.hostname })
    LOG.info(`actor ${id} is up, ${record.hostname}`)
    return this.get(id)
  }

  destroy(id) {
    return this.lock.run(() => this.#destroy(id))
  }

  async #destroy(id) {
    const record = this.get(id)
    LOG.info(`destroying actor ${id}`)
    this.trace(id, "destroy")
    await this.#teardown(record)
    return record
  }

  /** The process has to be gone before its disk is removed. */
  async #teardown(record) {
    await firecracker.terminate(firecracker.pidForApiSock(record.apiSock) ?? record.pid)
    if (record.tap) host.deleteTap(record.tap)
    rmSync(record.dir, { recursive: true, force: true })
    rmSync(join(this.publishedDir, record.id), { recursive: true, force: true })
    rmSync(join(this.versionsDir, record.id), { recursive: true, force: true })
  }

  // --------------------------------------------------------------- trace
  #tracePath(id) {
    return join(this.tracesDir, `${id}.jsonl`)
  }

  /** Best effort: a trace that cannot be written must not fail what it describes. */
  trace(id, event, fields = {}) {
    const line = Object.fromEntries(Object.entries({ ts: nowIso(), event, ...fields }).sort(([a], [b]) => (a < b ? -1 : 1)))
    try {
      mkdirSync(this.tracesDir, { recursive: true })
      appendFileSync(this.#tracePath(id), `${JSON.stringify(line)}\n`)
    } catch (error) {
      LOG.warn(`could not trace ${id} ${event}: ${error.message}`)
    }
  }

  traceOf(id, limit) {
    const path = this.#tracePath(id)
    if (!existsSync(path)) return []
    const events = readFileSync(path, "utf8").split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line))
    return limit ? events.slice(-limit) : events
  }

  // ------------------------------------------------------------- publish
  /**
   * Copy a directory out of a running actor and serve it. The tree is
   * untrusted: only files, directories, and links survive, and the server
   * refuses any path that resolves outside it.
   */
  publish(id, tree = "/brayness/site", site = id) {
    return this.lock.run(async () => {
      const target = join(this.publishedDir, id)
      const staging = join(this.publishedDir, `.${id}.part`)
      await this.copyOut(id, tree, staging)
      if (this.syncSites) {
        const source = join(this.publishedDir, `.${id}.source.part`)
        try {
          if (tree === "/brayness/work/site" || tree.startsWith("/brayness/work/site/")) await this.copyOut(id, "/brayness/work/site", source)
          const published = await this.syncSites.publish(this.get(id).owner, site, staging, existsSync(source) ? source : staging)
          this.trace(id, "publish", { site, path: tree, ...published })
          return { id: site, path: tree, ...published }
        } finally {
          rmSync(staging, { recursive: true, force: true })
          rmSync(source, { recursive: true, force: true })
        }
      }
      const previous = this.saveSite(id)
      try {
        renameSync(staging, target)
      } catch (error) {
        if (previous) {
          renameSync(join(this.versionsDir, id, previous), target)
          unlink(join(this.versionsDir, id, `${previous}.json`))
        }
        throw error
      }
      const files = listFiles(target)
      const published = { id, path: tree, files: files.length, bytes: files.reduce((sum, file) => sum + statSync(file).size, 0), url: `/s/${id}/` }
      this.trace(id, "publish", published)
      return published
    })
  }

  /** Move the live site into private version storage, if one exists. */
  saveSite(id) {
    const target = join(this.publishedDir, id)
    if (!existsSync(target)) return null
    const version = randomBytes(6).toString("hex")
    const directory = join(this.versionsDir, id)
    mkdirSync(directory, { recursive: true })
    renameSync(target, join(directory, version))
    writeJson(join(directory, `${version}.json`), { id: version, saved: new Date().toISOString() })
    return version
  }

  siteVersions(id, site = id) {
    const actor = this.get(id)
    if (this.syncSites) return this.syncSites.versions(actor.owner, site)
    const directory = join(this.versionsDir, id)
    if (!existsSync(directory)) return []
    return readdirSync(directory).filter(name => /^[0-9a-f]{12}\.json$/.test(name))
      .map(name => readJson(join(directory, name)))
      .sort((a, b) => b.saved.localeCompare(a.saved))
  }

  restoreSite(id, version, site = id) {
    return this.lock.run(async () => {
      const actor = this.get(id)
      if (this.syncSites) return this.syncSites.restore(actor.owner, site, version)
      if (typeof version !== "string" || !/^[0-9a-f]{12}$/.test(version)) throw new BadRequest("invalid site version")
      const directory = join(this.versionsDir, id)
      const source = join(directory, version)
      if (!existsSync(source)) throw new NotFound(version)
      const target = join(this.publishedDir, id)
      this.saveSite(id)
      renameSync(source, target)
      unlink(join(directory, `${version}.json`))
      this.trace(id, "restore-site", { version })
      return { url: `/s/${id}/` }
    })
  }

  unpublishSite(id, site = id) {
    return this.lock.run(async () => {
      const actor = this.get(id)
      if (this.syncSites) return this.syncSites.remove(actor.owner, site)
      const version = this.saveSite(id)
      if (!version) throw new NotFound(id)
      this.trace(id, "unpublish", { version })
      return { version }
    })
  }

  /** Copy an actor's directory into a fresh `dest`; only plain entries survive. */
  async copyOut(id, tree, dest) {
    if (typeof tree !== "string" || !tree.startsWith("/") || tree.split("/").includes("..")) {
      throw new BadRequest("path must be absolute, with no .. segments")
    }
    const result = await this.exec(id, ["tar", "-czf", "-", "-C", tree, "."])
    if (result.exit_code !== 0) {
      const detail = Buffer.from(result.stderr_b64, "base64").toString().trim()
      throw new BadRequest(`nothing to copy at ${tree}: ${detail || "tar failed"}`)
    }
    rmSync(dest, { recursive: true, force: true })
    mkdirSync(dest, { recursive: true })
    try {
      host.run(["tar", "-xzf", "-", "-C", dest, "--no-same-owner", "--no-same-permissions"], { input: Buffer.from(result.stdout_b64, "base64") })
      keepPlainEntries(dest)
    } catch (error) {
      rmSync(dest, { recursive: true, force: true })
      throw error
    }
  }

  publishedSite(id) {
    if (!ID.test(id)) return null
    const root = join(this.publishedDir, id)
    return existsSync(root) && statSync(root).isDirectory() ? root : null
  }

  // ------------------------------------------------------------- exports
  exports() {
    if (!existsSync(this.exportsDir)) return []
    return readdirSync(this.exportsDir)
      .sort()
      .filter((name) => existsSync(join(this.exportsDir, name, "manifest.json")))
      .map((name) => readJson(join(this.exportsDir, name, "manifest.json")))
      .sort((a, b) => (b.exported ?? "").localeCompare(a.exported ?? ""))
  }

  /** Write an actor out as a bundle; it is stopped first and left stopped. */
  export(id) {
    return this.lock.run(() => this.#export(id))
  }

  async #export(id) {
      let record = this.get(id)
      if (record.state === "running") record = await this.#idle(id, "disk")
      const disk = join(record.dir, DISK)
      if (!existsSync(disk)) throw new Busy(`actor ${id} has no disk to export`)
      const target = join(this.exportsDir, id)
      const staging = join(this.exportsDir, `.${id}.part`)
      rmSync(staging, { recursive: true, force: true })
      mkdirSync(staging, { recursive: true })
      let manifest
      try {
        const artifacts = join(staging, "artifacts.tar.gz")
        await host.mounted(disk, (tree) => host.run(["tar", "-czf", artifacts, "-C", tree, ...ARTIFACT_PATHS]))
        const listed = host.run(["tar", "-tzf", artifacts]).output
        const tracePath = this.#tracePath(id)
        const traceText = existsSync(tracePath) ? readFileSync(tracePath, "utf8") : ""
        writeFileSync(join(staging, "trace.jsonl"), traceText)
        manifest = {
          schema: 1,
          id,
          exported: nowIso(),
          actor: { id: record.id, created: record.created, machine_id: record.machine_id, hostname: record.hostname, owner: record.owner },
          artifacts: {
            path: "artifacts.tar.gz",
            bytes: statSync(artifacts).size,
            sha256: await sha256File(artifacts),
            entries: listed.split("\n").filter(Boolean).length,
            paths: ARTIFACT_PATHS,
          },
          trace: { path: "trace.jsonl", events: traceText.split("\n").filter((line) => line.trim()).length, bytes: Buffer.byteLength(traceText) },
          seed: this.seedFingerprint(),
        }
        writeJson(join(staging, "manifest.json"), manifest)
        rmSync(target, { recursive: true, force: true })
        renameSync(staging, target)
      } catch (error) {
        rmSync(staging, { recursive: true, force: true })
        throw error
      }
      this.trace(id, "export", { export: target, artifacts_sha256: manifest.artifacts.sha256, bytes: manifest.artifacts.bytes })
      LOG.info(`actor ${id} exported to ${target} (${manifest.artifacts.bytes} bytes)`)
      return manifest
  }

  /** Land a bundle on a fresh disk: the export's files, a new identity, the old trace. */
  restore(exportId, owner, { start = true } = {}) {
    return this.lock.run(async () => {
      if (!ID.test(exportId)) throw new NotFound(`export ${exportId}`)
      const exportDir = join(this.exportsDir, exportId)
      if (!existsSync(join(exportDir, "manifest.json"))) throw new NotFound(`export ${exportId}`)
      const manifest = readJson(join(exportDir, "manifest.json"))
      if (!manifest.actor?.owner || manifest.actor.owner !== owner) throw new NotFound(`export ${exportId}`)
      const artifacts = join(exportDir, manifest.artifacts.path)
      const digest = await sha256File(artifacts)
      if (digest !== manifest.artifacts.sha256) {
        throw new BadRequest(`export ${exportId} is corrupt: ${digest.slice(0, 12)} != ${manifest.artifacts.sha256.slice(0, 12)}`)
      }
      let record = await this.#create(owner)
      try {
        await this.#idle(record.id, "disk")
        await host.mounted(join(record.dir, DISK), (tree) => host.run(["tar", "-xzf", artifacts, "-C", tree, "--no-same-owner"]))
        const tracePath = this.#tracePath(record.id)
        const current = existsSync(tracePath) ? readFileSync(tracePath, "utf8") : ""
        writeFileSync(tracePath, readFileSync(join(exportDir, "trace.jsonl"), "utf8") + current)
        const seed = this.seedFingerprint()
        this.trace(record.id, "restore", { source: exportId, artifacts_sha256: digest, seed, seed_of_export: manifest.seed ?? null, seed_matches: JSON.stringify(seed) === JSON.stringify(manifest.seed) })
        if (start) record = await this.#reload(record.id)
      } catch (error) {
        LOG.warn(`restore of ${exportId} failed, rolling back`)
        await this.#teardown(record)
        throw error
      }
      LOG.info(`actor ${record.id} restored from ${exportId}`)
      return record
    })
  }

  // ------------------------------------------------------------- records
  #write(record) {
    const { id, created, tap, pid, machine_id, hostname, boot_id, owner, paths, last_activity } = record
    writeJson(join(record.dir, "actor.json"), { id, created, tap, pid, machine_id, hostname, boot_id, owner, paths, last_activity })
  }

  /** State comes from disk, not the record: after a reboot a recorded pid is a stranger. */
  #read(dir) {
    const stored = readJson(join(dir, "actor.json"))
    const record = new Actor({
      id: stored.id,
      created: stored.created ?? "",
      tap: stored.tap ?? "",
      pid: stored.pid ?? 0,
      dir,
      machine_id: stored.machine_id ?? "",
      hostname: stored.hostname ?? "",
      boot_id: stored.boot_id ?? "",
      owner: stored.owner ?? null,
      paths: stored.paths ?? null,
      last_activity: stored.last_activity ?? stored.created ?? "",
    })
    if (firecracker.pidForApiSock(record.apiSock)) record.state = "running"
    else if (existsSync(join(dir, STATE)) && existsSync(join(dir, MEM))) record.state = "idle"
    else record.state = "stopped"
    return record
  }

  get(id) {
    if (typeof id !== "string" || !ID.test(id) || NON_ACTOR_DIRS.has(id)) throw new NotFound(String(id))
    const dir = join(this.volume, id)
    if (!existsSync(join(dir, "actor.json"))) throw new NotFound(id)
    return this.#read(dir)
  }

  list() {
    const records = []
    for (const name of readdirSync(this.volume).sort()) {
      const dir = join(this.volume, name)
      if (NON_ACTOR_DIRS.has(name) || !lstatSync(dir).isDirectory()) continue
      if (existsSync(join(dir, "actor.json"))) {
        records.push(this.#read(dir))
      } else {
        // A create that died mid-flight. Reported: a leak nobody sees is worse.
        LOG.warn(`incomplete actor directory: ${dir}`)
        records.push(new Actor({ id: name, created: "", tap: "", pid: 0, dir, state: "incomplete" }))
      }
    }
    return records
  }

  liveActors() {
    return this.list().filter((record) => record.state === "running")
  }
}

/** Drop devices, fifos, and sockets from an untrusted tree. */
function keepPlainEntries(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) keepPlainEntries(path)
    else if (!entry.isFile() && !entry.isSymbolicLink()) unlinkSync(path)
  }
}

function listFiles(root) {
  return readdirSync(root, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath ?? entry.path, entry.name))
}
