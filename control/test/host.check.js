#!/usr/bin/env node
// h4a: the host's contract, black-box over HTTP. Written against the Python
// host; the JavaScript host must pass it unchanged. The four open h3 bugs sit
// at the bottom: failing tests, or todo where no harness drives them yet.
//
// Needs the dev host (`webspace dev host up`).
//
//   npm run check:host
//   API=http://127.0.0.1:8080 TERM_URL=http://127.0.0.1:8090 \
//   KILL="gcloud compute ssh brayness-1 --zone=us-central1-a --command='sudo kill -9 {pid}'" \
//   npm run check:host

import { execFileSync as exec_file_sync } from "node:child_process"
import { createHmac as create_hmac, randomBytes as random_bytes } from "node:crypto"
import { connect } from "node:net"
import { existsSync as exists_sync, readFileSync as read_file_sync } from "node:fs"
import assert from "node:assert/strict"
import { after, before, describe, test } from "node:test"

const API = process.env.API ?? "http://127.0.0.1:18080"
const TERM_URL = process.env.TERM_URL ?? "http://127.0.0.1:18090"
// How to kill a VM process on the host, as a crash would. {pid} is replaced.
const KILL = process.env.KILL ?? "limactl shell fc-local sudo kill -9 {pid}"

const made = new Set()
const owner = "+14156667777"
const secretPath = new URL("../../dist/host-pass-secret", import.meta.url)
const secret = process.env.HOST_PASS_SECRET ?? (exists_sync(secretPath) ? read_file_sync(secretPath, "utf8").trim() : null)

const hostPass = (phone = owner) => {
  assert.ok(secret && Buffer.byteLength(secret) >= 32, "HOST_PASS_SECRET required for check:host")
  const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone, exp: Math.floor(Date.now() / 1000) + 240 })).toString("base64url")
  return `${body}.${create_hmac("sha256", secret).update(body).digest("base64url")}`
}

const call = async (method, path, body, phone = owner) => {
  const init = { method, headers: { authorization: `Bearer ${hostPass(phone)}` } }
  if (body !== undefined) {
    init.headers["content-type"] = "application/json"
    init.body = typeof body === "string" ? body : JSON.stringify(body)
  }
  const response = await fetch(`${API}${path}`, init)
  const text = await response.text()
  const type = response.headers.get("content-type") ?? ""
  const json = type.includes("json") && text ? JSON.parse(text) : undefined
  return { status: response.status, type, text, json }
}

const create = async (body) => {
  const result = await call("POST", "/v1/actors", body)
  assert.equal(result.status, 201, result.text)
  made.add(result.json.id)
  return result.json
}

const destroy = async (id) => {
  const result = await call("DELETE", `/v1/actors/${id}`)
  made.delete(id)
  return result
}

const sh = async (id, command, timeout = 60) => {
  const result = await call("POST", `/v1/actors/${id}/exec`, {
    argv: ["/bin/sh", "-c", command],
    timeout,
  })
  assert.equal(result.status, 200, result.text)
  return {
    code: result.json.exit_code,
    out: Buffer.from(result.json.stdout_b64, "base64").toString(),
    err: Buffer.from(result.json.stderr_b64, "base64").toString(),
  }
}

const ACTOR_FIELDS = ["id", "state", "created", "tap", "pid", "hostname", "machine_id", "boot_id", "dir", "owner", "paths", "last_activity"]

after(async () => {
  for (const id of made) await destroy(id).catch(() => {})
})

describe("health", () => {
  test("reports the seed and actor counts", async () => {
    const { status, json } = await call("GET", "/v1/health")
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.equal(json.seed.built, true)
    assert.equal(json.seed.matches, true)
    assert.deepEqual(json.seed.mismatches, [])
    for (const key of ["machine_id", "boot_id", "created"]) assert.ok(key in json.seed, key)
    assert.equal(typeof json.actors, "object")
  })
})

describe("routes and errors", () => {
  test("unknown routes are JSON 404s", async () => {
    for (const [method, path] of [["GET", "/nope"], ["POST", "/nope"], ["DELETE", "/nope"]]) {
      const { status, json } = await call(method, path)
      assert.equal(status, 404, `${method} ${path}`)
      assert.match(json.error, /no route/)
    }
  })

  test("an unknown actor is a 404 on every verb", async () => {
    const id = "a-doesnotexist"
    for (const [method, path] of [
      ["GET", `/v1/actors/${id}`],
      ["POST", `/v1/actors/${id}/exec`],
      ["POST", `/v1/actors/${id}/idle`],
      ["POST", `/v1/actors/${id}/reload`],
      ["POST", `/v1/actors/${id}/export`],
      ["DELETE", `/v1/actors/${id}`],
    ]) {
      const body = path.endsWith("/exec") ? { argv: ["/bin/true"] } : undefined
      const { status, json } = await call(method, path, body)
      assert.equal(status, 404, `${method} ${path}`)
      assert.equal(json.error, "no such actor")
    }
  })

  test("an actor id cannot climb out of the volume", async () => {
    const { status } = await call("GET", "/v1/actors/..")
    assert.notEqual(status, 200)
  })

  test("a body that is not a JSON object is a 400", async () => {
    for (const body of ["{not json", "[1,2]"]) {
      const { status, json } = await call("POST", "/v1/actors", body)
      assert.equal(status, 400, body)
      assert.ok(json.error)
    }
  })

  test("restore_from must be a non-empty string", async () => {
    const { status } = await call("POST", "/v1/actors", { restore_from: 7 })
    assert.equal(status, 400)
  })

  test("restoring an unknown export is a 404", async () => {
    const { status } = await call("POST", "/v1/actors", { restore_from: "a-noexport" })
    assert.equal(status, 404)
  })

  test("nothing published is a plain 404", async () => {
    const { status, type } = await call("GET", "/s/a-doesnotexist/")
    assert.equal(status, 404)
    assert.match(type, /text\/plain/)
  })
})

describe("an actor's life", () => {
  let actor

  before(async () => {
    actor = await create()
  })

  test("create answers the record, running", () => {
    assert.deepEqual(Object.keys(actor).sort(), [...ACTOR_FIELDS].sort())
    assert.match(actor.id, /^a-/)
    assert.equal(actor.state, "running")
    assert.ok(actor.machine_id)
  })

  test("private routes reject missing and foreign passes", async () => {
    const path = `/v1/actors/${actor.id}`
    const missing = await fetch(`${API}${path}`)
    assert.equal(missing.status, 401)
    assert.equal((await call("GET", path, undefined, "+14155559999")).status, 404)
    assert.deepEqual((await call("GET", "/v1/actors", undefined, "+14155559999")).json.actors, [])
    assert.equal((await call("POST", `${path}/exec`, { argv: ["true"] }, "+14155559999")).status, 404)
    assert.equal((await call("DELETE", path, undefined, "+14155559999")).status, 404)
    assert.equal((await call("GET", path)).status, 200)
  })

  test("get and list agree with create", async () => {
    const one = await call("GET", `/v1/actors/${actor.id}`)
    assert.equal(one.status, 200)
    assert.equal(one.json.id, actor.id)
    const all = await call("GET", "/v1/actors")
    assert.ok(all.json.actors.some((s) => s.id === actor.id))
  })

  test("exec runs argv, passes stdin, and keeps exit codes", async () => {
    const echo = await sh(actor.id, "echo hello; echo oops >&2; exit 3")
    assert.equal(echo.code, 3)
    assert.equal(echo.out, "hello\n")
    assert.equal(echo.err, "oops\n")

    const cat = await call("POST", `/v1/actors/${actor.id}/exec`, {
      argv: ["/bin/cat"],
      stdin_b64: Buffer.from([0, 1, 2, 255]).toString("base64"),
    })
    assert.equal(cat.status, 200)
    assert.deepEqual([...Buffer.from(cat.json.stdout_b64, "base64")], [0, 1, 2, 255])

    const cwd = await call("POST", `/v1/actors/${actor.id}/exec`, { argv: ["/bin/pwd"], cwd: "/tmp" })
    assert.equal(Buffer.from(cwd.json.stdout_b64, "base64").toString().trim(), "/tmp")
  })

  test("exec rejects bad input with a 400", async () => {
    for (const body of [
      { argv: ["/bin/true"], stdin_b64: "!!!" },
      { argv: ["/bin/true"], stdin_b64: 5 },
      { argv: ["/bin/true"], timeout: 0 },
      { argv: ["/bin/true"], timeout: "10" },
      { argv: ["/bin/true"], timeout: 1e9 },
    ]) {
      const { status } = await call("POST", `/v1/actors/${actor.id}/exec`, body)
      assert.equal(status, 400, JSON.stringify(body))
    }
  })

  test("two execs in one actor run at once", async () => {
    // Overlap, not a wall-clock bound: a fresh vsock connection costs seconds,
    // so the proof is that the short sleep returns well before the long one.
    const started = Date.now()
    const long = sh(actor.id, "sleep 5").then(() => Date.now() - started)
    const short = sh(actor.id, "sleep 1").then(() => Date.now() - started)
    const [longMs, shortMs] = await Promise.all([long, short])
    assert.ok(shortMs + 1500 < longMs, `execs did not overlap: short ${shortMs}ms, long ${longMs}ms`)
  })

  test("idle to memory, then exec wakes it with files kept", async () => {
    await sh(actor.id, "echo kept > /brayness/h4a-memory")
    const idle = await call("POST", `/v1/actors/${actor.id}/idle`, {})
    assert.equal(idle.status, 200)
    assert.equal(idle.json.state, "idle")
    const again = await call("POST", `/v1/actors/${actor.id}/idle`, {})
    assert.equal(again.status, 200, "idle is idempotent")
    const read = await sh(actor.id, "cat /brayness/h4a-memory")
    assert.equal(read.out, "kept\n")
  })

  test("idle to disk stops it; reload boots the same disk", async () => {
    await sh(actor.id, "echo kept > /brayness/h4a-disk")
    const idle = await call("POST", `/v1/actors/${actor.id}/idle`, { tier: "disk" })
    assert.equal(idle.json.state, "stopped")
    const reload = await call("POST", `/v1/actors/${actor.id}/reload`)
    assert.equal(reload.status, 200)
    assert.equal(reload.json.state, "running")
    assert.equal(reload.json.machine_id, actor.machine_id, "identity persists")
    assert.equal((await sh(actor.id, "cat /brayness/h4a-disk")).out, "kept\n")
  })

  test("an unknown idle tier is a 400", async () => {
    const { status } = await call("POST", `/v1/actors/${actor.id}/idle`, { tier: "freezer" })
    assert.equal(status, 400)
  })

  test("publish serves the tree at its returned URL", async () => {
    await sh(actor.id, "mkdir -p /brayness/site/blog && echo '<h1>hi</h1>' > /brayness/site/index.html && echo post > /brayness/site/blog/hello.html")
    const published = await call("POST", `/v1/actors/${actor.id}/publish`, {})
    assert.equal(published.status, 200, published.text)
    assert.equal(published.json.files, 2)

    if (published.json.url.startsWith("/sites/")) {
      const origin = process.env.SYNC_SITE_PUBLIC_URL ?? "http://127.0.0.1:18096"
      const site = `${origin}${published.json.url}`
      const index = await fetch(site)
      assert.equal(index.status, 200)
      assert.match(index.headers.get("content-type"), /text\/html/)
      assert.equal(await index.text(), "<h1>hi</h1>\n")
      assert.equal(await (await fetch(`${site}blog/hello`)).text(), "post\n", "pretty links")
      assert.equal((await fetch(`${site}missing.css`)).status, 404)
    } else {
      assert.equal(published.json.url, `/s/${actor.id}/`)
      const index = await call("GET", `/s/${actor.id}/`)
      assert.equal(index.status, 200)
      assert.match(index.type, /text\/html/)
      assert.equal(index.text, "<h1>hi</h1>\n")
      assert.equal((await call("GET", `/s/${actor.id}/blog/hello`)).text, "post\n", "pretty links")
      assert.equal((await call("GET", `/s/${actor.id}/missing.css`)).status, 404)
      const port = new URL(API).port
      const vhost = exec_file_sync("curl", ["-s", "-H", `Host: ${actor.id}.localhost:${port}`, `${API}/`]).toString()
      assert.equal(vhost, "<h1>hi</h1>\n")
    }
  })

  test("publish refuses relative and climbing paths", async () => {
    for (const path of ["site", "/brayness/../etc", 5]) {
      const { status } = await call("POST", `/v1/actors/${actor.id}/publish`, { path })
      assert.equal(status, 400, String(path))
    }
    const missing = await call("POST", `/v1/actors/${actor.id}/publish`, { path: "/nope" })
    assert.equal(missing.status, 400)
  })

  test("a published path cannot leave the site", async () => {
    const out = exec_file_sync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "--path-as-is",
      `${API}/s/${actor.id}/../../etc/passwd`]).toString()
    assert.notEqual(out, "200")
  })

  test("the trace records what happened, oldest first", async () => {
    const { json } = await call("GET", `/v1/actors/${actor.id}/trace`)
    const events = json.events.map((e) => e.event)
    for (const event of ["idle", "reload", "publish"]) assert.ok(events.includes(event), event)
    const times = json.events.map((e) => e.ts)
    assert.deepEqual(times, [...times].sort())
  })

  test("export leaves it stopped; restore makes a new identity with the files", async () => {
    const manifest = await call("POST", `/v1/actors/${actor.id}/export`)
    assert.equal(manifest.status, 200, manifest.text)
    assert.equal(manifest.json.schema, 1)
    assert.equal(manifest.json.id, actor.id)
    assert.deepEqual(manifest.json.artifacts.paths, ["brayness"])
    assert.match(manifest.json.artifacts.sha256, /^[0-9a-f]{64}$/)
    assert.equal((await call("GET", `/v1/actors/${actor.id}`)).json.state, "stopped")

    const exports = await call("GET", "/v1/exports")
    assert.ok(exports.json.exports.some((e) => e.id === actor.id))

    const foreign = await call("POST", "/v1/actors", { restore_from: actor.id }, "+14155559999")
    assert.equal(foreign.status, 404, foreign.text)

    const copy = await create({ restore_from: actor.id })
    assert.notEqual(copy.id, actor.id)
    assert.notEqual(copy.machine_id, actor.machine_id)
    assert.equal((await sh(copy.id, "cat /brayness/h4a-disk")).out, "kept\n")
    const restored = await sh(copy.id, "test -f /brayness/bin/pi && test ! -e /root/brayness && printf '%s' \"$HOME\"")
    assert.equal(restored.code, 0, restored.err)
    assert.equal(restored.out, "/brayness")
    const trace = await call("GET", `/v1/actors/${copy.id}/trace`)
    const events = trace.json.events.map((e) => e.event)
    assert.ok(events.includes("publish"), "the source's trace came along")
    assert.ok(events.includes("restore"))
  })

  test("destroy is a 204 and the actor and site are gone", async () => {
    const gone = await destroy(actor.id)
    assert.equal(gone.status, 204)
    assert.equal(gone.text, "")
    assert.equal((await call("GET", `/v1/actors/${actor.id}`)).status, 404)
    assert.equal((await call("GET", `/s/${actor.id}/`)).status, 404)
  })
})

describe("terminal", () => {
  test("a websocket without an actor is a 400", () => {
    const status = exec_file_sync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}",
      "-H", "Upgrade: websocket", "-H", "Connection: Upgrade", "-H", "Sec-WebSocket-Key: x",
      `${TERM_URL}/pty`]).toString()
    assert.equal(status, "400")
  })

  // s1: actor-init replaces the seed's Pi; the page's attach must land in it.
  test("a new actor's terminal opens in Pi, as the page attaches", async () => {
    const actor = await create()
    const opener = Buffer.from("exec brayness\r").toString("base64")
    const text = await terminal(actor.id, /inkling/, { ms: 120000, send: [{ op: "resize", cols: 80, rows: 24 }, { op: "data", data_b64: opener }] })
    assert.match(text, /inkling/)
    await destroy(actor.id)
  })

  test("a terminal opens and draws", async () => {
    const actor = await create()
    const text = await terminal(actor.id, /\S/)
    assert.match(text, /\S/)
    await destroy(actor.id)
  })
})

// A websocket to the actor's terminal. Frames are the guest's
// `{"op": "data", "data_b64"}` lines; resolves with the decoded text once
// `until` matches, leaving the socket open when `keep` is set.
const terminal = async (id, until, { keep = false, ms = 30000, send = [] } = {}) => {
  const auth = await fetch(`${TERM_URL}/auth`, {
    method: "POST", headers: { origin: TERM_URL }, body: JSON.stringify({ pass: hostPass() }),
  })
  assert.equal(auth.status, 204)
  const cookie = auth.headers.get("set-cookie").split(";")[0]
  const ticket = await fetch(`${TERM_URL}/ticket?actor=${id}`, {
    method: "POST", headers: { origin: TERM_URL, cookie },
  })
  assert.equal(ticket.status, 200)
  const { ticket: key } = await ticket.json()
  const url = new URL(TERM_URL)
  const socket = connect(Number(url.port), url.hostname)
  const handshake = random_bytes(16).toString("base64")
  socket.write(`GET /pty?actor=${id}&cols=80&rows=24&ticket=${key} HTTP/1.1\r\nHost: ${url.host}\r\nOrigin: ${TERM_URL}\r\nCookie: ${cookie}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: ${handshake}\r\n\r\n`)
  let buffer = Buffer.alloc(0)
  let text = ""
  let upgraded = false
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.destroy(); reject(new Error(`no ${until} in: ${text.slice(-300)}`)) }, ms)
    socket.on("error", (error) => { clearTimeout(timer); reject(error) })
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      if (!upgraded) {
        const end = buffer.indexOf("\r\n\r\n")
        if (end < 0) return
        const status = buffer.subarray(0, end).toString()
        if (!status.startsWith("HTTP/1.1 101")) { clearTimeout(timer); socket.destroy(); return reject(new Error(status)) }
        buffer = buffer.subarray(end + 4)
        upgraded = true
        for (const message of send) socket.write(clientFrame(JSON.stringify(message)))
      }
      while (buffer.length >= 2) {
        const length = buffer[1] & 127
        const offset = length === 126 ? 4 : length === 127 ? 10 : 2
        if (buffer.length < offset) break
        const size = length === 126 ? buffer.readUInt16BE(2) : length === 127 ? Number(buffer.readBigUInt64BE(2)) : length
        if (buffer.length < offset + size) break
        const frame = buffer.subarray(offset, offset + size).toString()
        buffer = buffer.subarray(offset + size)
        for (const match of frame.matchAll(/"data_b64":\s*"([^"]*)"/g)) text += Buffer.from(match[1], "base64").toString()
        if (until.test(text)) {
          clearTimeout(timer)
          if (!keep) socket.destroy()
          return resolve(keep ? { text, ws: { close: () => socket.destroy() } } : text)
        }
      }
    })
  })
}

// A browser's text frame: clients must mask (RFC 6455).
const clientFrame = (text) => {
  const payload = Buffer.from(text)
  const mask = random_bytes(4)
  const size = payload.length
  const head = size < 126 ? Buffer.from([0x81, 0x80 | size]) : Buffer.from([0x81, 0x80 | 126, size >> 8, size & 255])
  return Buffer.concat([head, mask, payload.map((byte, i) => byte ^ mask[i % 4])])
}

describe("h3 lessons", () => {
  test("destroy with a terminal attached finishes", async () => {
    const actor = await create()
    const { ws } = await terminal(actor.id, /\S/, { keep: true })
    const started = Date.now()
    const gone = await destroy(actor.id)
    ws.close()
    assert.equal(gone.status, 204, gone.text)
    assert.ok(Date.now() - started < 15000, `destroy took ${Date.now() - started}ms`)
    const list = await call("GET", "/v1/actors")
    assert.ok(!list.json.actors.some((s) => s.id === actor.id), "no orphan")
  })

  test("a hard stop keeps every file written before it", async () => {
    const actor = await create()
    const count = 3000
    await sh(actor.id, `mkdir -p /brayness/h4a && cd /brayness/h4a && i=0; while [ $i -lt ${count} ]; do echo $i > f$i; i=$((i+1)); done`, 120)
    // What a host crash looks like: the VM process dies, no idle, no sync.
    exec_file_sync("sh", ["-c", KILL.replaceAll("{pid}", String(actor.pid))], { stdio: "ignore" })
    const reload = await call("POST", `/v1/actors/${actor.id}/reload`)
    assert.equal(reload.status, 200, reload.text)
    const empty = await sh(actor.id, `cd /brayness/h4a || exit 9; ls | wc -l; find . -type f -empty | wc -l`)
    assert.equal(empty.code, 0, "/brayness/h4a survived the stop")
    const [files, blank] = empty.out.trim().split(/\s+/).map(Number)
    assert.equal(files, count, "every file exists")
    assert.equal(blank, 0, "no file lost its contents")
    await destroy(actor.id)
  })

})
