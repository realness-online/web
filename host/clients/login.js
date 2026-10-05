#!/usr/bin/env node
/**
 * A real terminal into one actor.
 *
 *   node host/clients/login.js --phone +14156667777
 *   node host/clients/login.js --actor a-abc123 --send 'exec brayness'
 *
 * Mints a host pass for that phone, creates an actor when none is named, and
 * pipes this terminal through the actor's pty. The actor is destroyed when the
 * terminal exits, so a dropped connection leaves nothing behind; KEEP=1 idles
 * it to memory instead and prints its id.
 *
 * The pass is signed with the fleet-wide host secret - the same value the sync
 * service mints from - read from HOST_PASS_SECRET_FILE, else
 * /etc/brayness/host-pass-secret, else this repo's dist/host-pass-secret.
 * Nothing is written to disk.
 *
 * The pty stream is the API's port plus one, which is what `main.js serve`
 * uses. Override with --pty.
 */
import { createConnection as create_connection } from "node:net"
import { readFileSync as read_file_sync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath as file_url_to_path } from "node:url"
import { issue_host_pass } from "../src/host-pass.js"

const HERE = dirname(file_url_to_path(import.meta.url))
const ROOT = join(HERE, "..", "..")
const SECRET_FILES = [
  process.env.HOST_PASS_SECRET_FILE,
  "/etc/brayness/host-pass-secret",
  join(ROOT, "dist", "host-pass-secret"),
].filter(Boolean)

/** A value after `--name`, or the default. */
const value_of = (argv, name, fallback) => {
  const at = argv.indexOf(`--${name}`)
  return at === -1 ? fallback : argv[at + 1]
}

const read_secret = () => {
  const tried = []
  for (const path of SECRET_FILES) {
    try {
      const secret = read_file_sync(path, "utf8").trim()
      if (secret.length < 32) throw new Error(`${path} holds a secret shorter than 32 bytes`)
      return secret
    } catch (error) {
      if (error.code !== "ENOENT") throw error
      tried.push(path)
    }
  }
  throw new Error(`no host pass secret; tried ${tried.join(", ")}`)
}

/** One JSON line per frame, in both directions. */
const frames = (socket) => {
  let buffer = ""
  const queue = []
  const waiters = []

  const deliver = () => {
    while (queue.length && waiters.length) waiters.shift().resolve(queue.shift())
  }
  socket.on("data", (chunk) => {
    buffer += chunk
    for (;;) {
      const end = buffer.indexOf("\n")
      if (end === -1) break
      const line = buffer.slice(0, end)
      buffer = buffer.slice(end + 1)
      if (line.trim()) queue.push(JSON.parse(line))
    }
    deliver()
  })
  socket.on("error", (error) => {
    for (const waiter of waiters.splice(0)) waiter.reject(error)
  })
  socket.on("close", () => {
    for (const waiter of waiters.splice(0)) waiter.reject(new Error("the pty stream closed"))
  })

  return {
    send: (frame) => socket.write(`${JSON.stringify(frame)}\n`),
    next: () =>
      new Promise((resolve, reject) => {
        if (queue.length) return resolve(queue.shift())
        waiters.push({ resolve, reject })
      }),
  }
}

const create_actor = async ({ api, pass, phone }) => {
  const response = await fetch(`${api}/v1/actors`, { method: "POST", headers: { authorization: `Bearer ${pass}` } })
  if (!response.ok) throw new Error(`could not create an actor for ${phone}: ${response.status} ${await response.text()}`)
  return (await response.json()).id
}

const release = async ({ api, pass, actor, keep }) => {
  // A hung API answer must not hold the terminal open.
  const init = { headers: { authorization: `Bearer ${pass}` }, signal: AbortSignal.timeout(5000) }
  const action = keep
    ? fetch(`${api}/v1/actors/${actor}/idle`, { ...init, method: "POST", headers: { ...init.headers, "content-type": "application/json" }, body: JSON.stringify({ tier: "memory" }) })
    : fetch(`${api}/v1/actors/${actor}`, { ...init, method: "DELETE" })
  await action.catch(() => {})
}

const main = async (argv) => {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write("usage: login.js --phone +E164 [--actor <id>] [--send 'exec brayness'] [--api <url>] [--pty <host:port>]\n")
    return 0
  }
  const phone = value_of(argv, "phone")
  if (!phone) throw new Error("--phone is required: the number that owns the actor")
  if (!process.stdin.isTTY) throw new Error("a real terminal is required; run this from a terminal, not a pipe")

  const api = value_of(argv, "api", "http://127.0.0.1:8080")
  const target = new URL(api)
  const pty = new URL(`tcp://${value_of(argv, "pty", `${target.hostname}:${Number(target.port || 80) + 1}`)}`)
  const send = value_of(argv, "send", "")
  const keep = Boolean(process.env.KEEP)

  const pass = issue_host_pass({ phone }, read_secret())
  const actor = value_of(argv, "actor") ?? (await create_actor({ api, pass, phone }))
  process.stderr.write(`actor ${actor}${value_of(argv, "actor") ? "" : ` (new for ${phone})`}\n`)

  const socket = create_connection({ host: pty.hostname, port: Number(pty.port) })
  await new Promise((done, fail) => {
    socket.once("connect", done)
    socket.once("error", fail)
  })
  const stream = frames(socket)
  stream.send({ actor, cols: process.stdout.columns || 80, rows: process.stdout.rows || 24, pass })
  const hello = await stream.next()
  if (hello.error) throw new Error(hello.error)

  const was_raw = process.stdin.isRaw ?? false
  if (process.stdin.setRawMode) process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.on("data", (data) => stream.send({ op: "data", data_b64: data.toString("base64") }))
  process.stdout.on("resize", () => stream.send({ op: "resize", cols: process.stdout.columns, rows: process.stdout.rows }))

  // One exit path. A raw, resumed stdin keeps the process alive on its own, so
  // every ending - the guest's exit frame, a closed socket, a signal - lands
  // here, releases the actor, and exits.
  let finished = false
  const finish = async (code) => {
    if (finished) return
    finished = true
    if (process.stdin.setRawMode) process.stdin.setRawMode(was_raw)
    socket.destroy()
    await release({ api, pass, actor, keep })
    process.stderr.write(keep ? `actor ${actor} left idle (KEEP=1)\n` : `actor ${actor} released\n`)
    process.exit(code)
  }

  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => finish(0))
  process.stdin.on("end", () => finish(0))
  process.stdin.on("error", () => finish(0))
  socket.on("close", () => finish(0))
  if (send) stream.send({ op: "data", data_b64: Buffer.from(`${send}\n`).toString("base64") })

  for (;;) {
    const frame = await stream.next().catch(() => null)
    if (!frame) return finish(0)
    if (frame.op === "exit") return finish(frame.code ?? 0)
    if (frame.op === "data") process.stdout.write(Buffer.from(frame.data_b64, "base64"))
  }
}

try {
  process.exitCode = await main(process.argv.slice(2))
} catch (error) {
  process.stderr.write(`login: ${error.message}\n`)
  process.exitCode = 1
}
