// u2d's probe, as a handler: an app that tries every way out of its VM and
// reports each try. GET /probe answers JSON {name: {refused, detail}}; every
// one must be refused. app-escape-check.sh copies this beside targets.json,
// which names the host's real listening ports so the probes aim at live ones.
//
// Standard library only, under our server and --permission, like any app. The
// file and process probes therefore meet Node's permission model first; the
// read-only disks and the non-root user beneath it are checked from the host.

import { readFileSync as read_file_sync, writeFileSync as write_file_sync } from "node:fs"
import { execFileSync as exec_file_sync } from "node:child_process"
import { Worker } from "node:worker_threads"
import { connect, createServer as create_server } from "node:net"
import { lookup } from "node:dns/promises"
import { networkInterfaces as network_interfaces } from "node:os"

const TARGETS = JSON.parse(read_file_sync(new URL("./targets.json", import.meta.url), "utf8"))

const ownAddress = () => network_interfaces().eth0.find((a) => a.family === "IPv4").address

/** Refused when the TCP connect fails; a timeout (dropped) counts as refused. */
const tryConnect = (host, port, ms = 1500) => {
  return new Promise((done) => {
    const socket = connect({ host, port })
    const finish = (refused, detail) => {
      socket.destroy()
      done([refused, detail])
    }
    socket.setTimeout(ms, () => finish(true, `${host}:${port} timeout`))
    socket.on("connect", () => finish(false, `connected to ${host}:${port}`))
    socket.on("error", (error) => finish(true, `${host}:${port} ${error.code}`))
  })
}

const reach = async (targets) => {
  const tries = await Promise.all(targets.map(([h, p]) => tryConnect(h, p)))
  const open = tries.filter(([refused]) => !refused).map(([, d]) => d)
  return [open.length === 0, open.join("; ") || `${tries.length} tries, none connected`]
}

const attempt = (what) => {
  try {
    what()
    return [false, "allowed"]
  } catch (error) {
    return [true, error.code ?? error.name]
  }
}

const probes = async () => {
  const me = ownAddress()
  const gateway = me.replace(/\.\d+$/, ".1")
  const results = {}

  // The network: host, siblings, actors, metadata, the internet, names.
  results["host services"] = await reach([gateway, ...TARGETS.host_addresses].flatMap((a) => TARGETS.host_ports.map((p) => [a, p])))
  results["sibling apps"] = await reach([...Array(8).keys()].map((i) => `172.17.${i + 1}.2`).filter((a) => a !== me).map((a) => [a, 8080]))
  results["actors"] = await reach([0, 1, 2, 3].flatMap((i) => [1, 2].flatMap((h) => [22, 52, 8080].map((p) => [`172.16.${i}.${h}`, p]))))
  results["metadata"] = await reach([["169.254.169.254", 80]])
  results["internet"] = await reach([["1.1.1.1", 443], ["1.1.1.1", 80], ["8.8.8.8", 53], ...(TARGETS.internet ?? []).map((a) => [a, 443])])
  try {
    await lookup("example.com")
    results["dns"] = [false, "example.com resolved"]
  } catch (error) {
    results["dns"] = [true, error.code]
  }

  // Node's permission model: nothing outside its own code, no processes.
  results["write its code"] = attempt(() => write_file_sync("/app/code/escape", "x"))
  results["write /tmp"] = attempt(() => write_file_sync("/tmp/escape", "x"))
  results["read /etc/shadow"] = attempt(() => read_file_sync("/etc/shadow"))
  results["read /proc"] = attempt(() => read_file_sync("/proc/self/status"))
  results["read the runtime"] = attempt(() => read_file_sync("/opt/runtime/bin/node"))
  results["spawn a process"] = attempt(() => exec_file_sync("/bin/sh", ["-c", "id"]))
  results["start a worker"] = attempt(() => new Worker("0", { eval: true }))
  results["not root"] = [process.getuid() !== 0, `uid ${process.getuid()}`]

  return Object.fromEntries(Object.entries(results).map(([name, [refused, detail]]) => [name, { refused, detail }]))
}

export default {
  async fetch(request) {
    if (new URL(request.url).pathname === "/probe") return Response.json(await probes())
    return Response.json({ ok: true })
  },
}

// A second listener: the host must reach no port but 8080.
create_server((socket) => socket.end("side door\n")).listen(8081)
