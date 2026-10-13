
import { spawn as spawn_process, spawnSync as spawn_sync } from "node:child_process"
import { existsSync as exists_sync, openSync as open_sync, closeSync as close_sync, readdirSync as readdir_sync, readFileSync as read_file_sync, realpathSync as realpath_sync } from "node:fs"
import { request } from "node:http"
import { resolve } from "node:path"
import { FirecrackerError } from "./errors.js"

const BOOT_ARGS = "keep_bootcon console=ttyS0 reboot=k panic=1"
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

export class Api {
  constructor(socketPath, timeoutSeconds = 30) {
    this.socketPath = socketPath
    this.timeout = timeoutSeconds * 1000
  }

  call(method, path, body) {
    const payload = body === undefined ? undefined : JSON.stringify(body)
    const where = `${method} ${path}`
    return new Promise((done, fail) => {
      const call = request(
        {
          socketPath: this.socketPath,
          method,
          path,
          headers: payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {},
          timeout: this.timeout,
        },
        (response) => {
          const chunks = []
          response.on("data", (chunk) => chunks.push(chunk))
          response.on("end", () => {
            const raw = Buffer.concat(chunks).toString()
            if (response.statusCode >= 400) return fail(new FirecrackerError(`${where}: ${response.statusCode} ${raw.trim()}`))
            done(raw ? JSON.parse(raw) : {})
          })
        },
      )
      call.on("timeout", () => call.destroy(new Error("timed out")))
      call.on("error", (error) => fail(new FirecrackerError(`${where}: ${error.message}`)))
      call.end(payload)
    })
  }

  put = (path, body) => this.call("PUT", path, body)
  patch = (path, body) => this.call("PATCH", path, body)
}

/** The first line of `--version`; the exit banner after it would change every run. */
export const version = (binary) => {
  const result = spawn_sync(binary, ["--version"], { encoding: "utf8" })
  const first = `${result.stdout ?? ""}`.trim().split("\n")[0]?.trim()
  return first || "unknown"
}

/** Start Firecracker with `cwd` as its working directory; the cwd picks the disk (f5a). */
export const spawn = (binary, cwd, apiSock, logPath) => {
  const log = open_sync(logPath, "a")
  try {
    return spawn_process(binary, ["--api-sock", apiSock], { cwd, stdio: ["ignore", log, log] })
  } finally {
    close_sync(log)
  }
}

export const waitForApiSocket = async (path, seconds = 10) => {
  const deadline = Date.now() + seconds * 1000
  while (Date.now() < deadline) {
    if (exists_sync(path)) return
    await sleep(50)
  }
  throw new FirecrackerError(`no api socket at ${path} after ${seconds}s`)
}

const real = (path) => {
  try {
    return realpath_sync(path)
  } catch {
    return resolve(path)
  }
}

/**
 * The Firecracker that owns `apiSock`, or null. The command line is the
 * identity, not a recorded pid: after a host reboot a reused pid is a stranger.
 */
export const pidForApiSock = (apiSock) => {
  const want = real(apiSock)
  for (const name of readdir_sync("/proc")) {
    if (!/^\d+$/.test(name)) continue
    let args
    try {
      args = read_file_sync(`/proc/${name}/cmdline`).toString().split("\0").filter(Boolean)
    } catch {
      continue
    }
    const flag = args.indexOf("--api-sock")
    if (flag !== -1 && real(args[flag + 1]) === want) return Number(name)
  }
  return null
}

/** Running, and not a zombie: a zombie holds nothing but is still named firecracker. */
export const alive = (pid) => {
  if (!pid) return false
  try {
    const stat = read_file_sync(`/proc/${pid}/stat`, "utf8")
    if (stat.slice(stat.lastIndexOf(") ") + 2).split(" ")[0] === "Z") return false
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * SIGTERM, then SIGKILL. Node reaps its own children; an unreaped one would be
 * a zombie named firecracker that holds the idle guard awake forever.
 */
export const terminate = async (pid, seconds = 10) => {
  if (!alive(pid)) return
  try {
    process.kill(pid, "SIGTERM")
  } catch {}
  const deadline = Date.now() + seconds * 1000
  while (Date.now() < deadline && alive(pid)) await sleep(50)
  if (alive(pid)) {
    try {
      process.kill(pid, "SIGKILL")
    } catch {}
    await sleep(100)
  }
}

/**
 * A fresh VM: the seed from the template disk, or an app. `readOnly` maps
 * drive ids to extra disks attached read-only; an app has no `uds`, so no vsock.
 */
export const boot = async (api, { kernel, disk, tap, uds, mac, cid, vcpus, mib, huge_pages, readOnly = {} }) => {
  await api.put("/boot-source", { kernel_image_path: kernel, boot_args: BOOT_ARGS })
  await api.put("/drives/rootfs", { drive_id: "rootfs", path_on_host: disk, is_root_device: true, is_read_only: false })
  for (const [id, path] of Object.entries(readOnly)) {
    await api.put(`/drives/${id}`, { drive_id: id, path_on_host: path, is_root_device: false, is_read_only: true })
  }
  await api.put("/machine-config", { vcpu_count: vcpus, mem_size_mib: mib, ...(huge_pages && { huge_pages }) })
  await api.put("/network-interfaces/eth0", { iface_id: "eth0", host_dev_name: tap, guest_mac: mac })
  if (uds) await api.put("/vsock", { guest_cid: cid, uds_path: uds })
  await api.put("/actions", { action_type: "InstanceStart" })
}

export const pause = (api) => api.patch("/vm", { state: "Paused" })

export const createSnapshot = (api, state, mem) =>
  api.put("/snapshot/create", { snapshot_type: "Full", snapshot_path: state, mem_file_path: mem })

/** Resume a snapshot, running on return. Actors pass a vsock; a Chrome VM has none (c1). */
export const loadSnapshot = (api, state, mem, tap, uds) =>
  api.put("/snapshot/load", {
    snapshot_path: state,
    mem_backend: { backend_path: mem, backend_type: "File" },
    network_overrides: [{ iface_id: "eth0", host_dev_name: tap }],
    ...(uds && { vsock_override: { uds_path: uds } }),
    resume_vm: true,
  })
