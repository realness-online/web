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

import { execFileSync } from "node:child_process"
import assert from "node:assert/strict"
import { after, before, describe, test } from "node:test"

const API = process.env.API ?? "http://127.0.0.1:18080"
const TERM_URL = process.env.TERM_URL ?? "http://127.0.0.1:18090"
// How to kill a VM process on the host, as a crash would. {pid} is replaced.
const KILL = process.env.KILL ?? "limactl shell fc-local sudo kill -9 {pid}"

const made = new Set()

async function call(method, path, body) {
  const init = { method, headers: {} }
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

async function create(body) {
  const result = await call("POST", "/v1/sessions", body)
  assert.equal(result.status, 201, result.text)
  made.add(result.json.id)
  return result.json
}

async function destroy(id) {
  const result = await call("DELETE", `/v1/sessions/${id}`)
  made.delete(id)
  return result
}

async function sh(id, command, timeout = 60) {
  const result = await call("POST", `/v1/sessions/${id}/exec`, {
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

const SESSION_FIELDS = ["id", "state", "created", "tap", "pid", "hostname", "machine_id", "boot_id", "dir"]

after(async () => {
  for (const id of made) await destroy(id).catch(() => {})
})

describe("health", () => {
  test("reports the seed and session counts", async () => {
    const { status, json } = await call("GET", "/v1/health")
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.equal(json.seed.built, true)
    assert.equal(json.seed.matches, true)
    assert.deepEqual(json.seed.mismatches, [])
    for (const key of ["machine_id", "boot_id", "created"]) assert.ok(key in json.seed, key)
    assert.equal(typeof json.sessions, "object")
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

  test("an unknown session is a 404 on every verb", async () => {
    const id = "s-doesnotexist"
    for (const [method, path] of [
      ["GET", `/v1/sessions/${id}`],
      ["POST", `/v1/sessions/${id}/exec`],
      ["POST", `/v1/sessions/${id}/idle`],
      ["POST", `/v1/sessions/${id}/reload`],
      ["POST", `/v1/sessions/${id}/export`],
      ["DELETE", `/v1/sessions/${id}`],
    ]) {
      const body = path.endsWith("/exec") ? { argv: ["/bin/true"] } : undefined
      const { status, json } = await call(method, path, body)
      assert.equal(status, 404, `${method} ${path}`)
      assert.equal(json.error, "no such session")
    }
  })

  test("a session id cannot climb out of the volume", async () => {
    const { status } = await call("GET", "/v1/sessions/..")
    assert.notEqual(status, 200)
  })

  test("a body that is not a JSON object is a 400", async () => {
    for (const body of ["{not json", "[1,2]"]) {
      const { status, json } = await call("POST", "/v1/sessions", body)
      assert.equal(status, 400, body)
      assert.ok(json.error)
    }
  })

  test("restore_from must be a non-empty string", async () => {
    const { status } = await call("POST", "/v1/sessions", { restore_from: 7 })
    assert.equal(status, 400)
  })

  test("restoring an unknown export is a 404", async () => {
    const { status } = await call("POST", "/v1/sessions", { restore_from: "s-noexport" })
    assert.equal(status, 404)
  })

  test("nothing published is a plain 404", async () => {
    const { status, type } = await call("GET", "/s/s-doesnotexist/")
    assert.equal(status, 404)
    assert.match(type, /text\/plain/)
  })
})

describe("a session's life", () => {
  let session

  before(async () => {
    session = await create()
  })

  test("create answers the record, running", () => {
    assert.deepEqual(Object.keys(session).sort(), [...SESSION_FIELDS].sort())
    assert.match(session.id, /^s-/)
    assert.equal(session.state, "running")
    assert.ok(session.machine_id)
  })

  test("get and list agree with create", async () => {
    const one = await call("GET", `/v1/sessions/${session.id}`)
    assert.equal(one.status, 200)
    assert.equal(one.json.id, session.id)
    const all = await call("GET", "/v1/sessions")
    assert.ok(all.json.sessions.some((s) => s.id === session.id))
  })

  test("exec runs argv, passes stdin, and keeps exit codes", async () => {
    const echo = await sh(session.id, "echo hello; echo oops >&2; exit 3")
    assert.equal(echo.code, 3)
    assert.equal(echo.out, "hello\n")
    assert.equal(echo.err, "oops\n")

    const cat = await call("POST", `/v1/sessions/${session.id}/exec`, {
      argv: ["/bin/cat"],
      stdin_b64: Buffer.from([0, 1, 2, 255]).toString("base64"),
    })
    assert.equal(cat.status, 200)
    assert.deepEqual([...Buffer.from(cat.json.stdout_b64, "base64")], [0, 1, 2, 255])

    const cwd = await call("POST", `/v1/sessions/${session.id}/exec`, { argv: ["/bin/pwd"], cwd: "/tmp" })
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
      const { status } = await call("POST", `/v1/sessions/${session.id}/exec`, body)
      assert.equal(status, 400, JSON.stringify(body))
    }
  })

  test("two execs in one session run at once", async () => {
    const started = Date.now()
    await Promise.all([sh(session.id, "sleep 3"), sh(session.id, "sleep 3")])
    assert.ok(Date.now() - started < 5500, `took ${Date.now() - started}ms`)
  })

  test("idle to memory, then exec wakes it with files kept", async () => {
    await sh(session.id, "echo kept > /root/h4a-memory")
    const idle = await call("POST", `/v1/sessions/${session.id}/idle`, {})
    assert.equal(idle.status, 200)
    assert.equal(idle.json.state, "idle")
    const again = await call("POST", `/v1/sessions/${session.id}/idle`, {})
    assert.equal(again.status, 200, "idle is idempotent")
    const read = await sh(session.id, "cat /root/h4a-memory")
    assert.equal(read.out, "kept\n")
  })

  test("idle to disk stops it; reload boots the same disk", async () => {
    await sh(session.id, "echo kept > /root/h4a-disk")
    const idle = await call("POST", `/v1/sessions/${session.id}/idle`, { tier: "disk" })
    assert.equal(idle.json.state, "stopped")
    const reload = await call("POST", `/v1/sessions/${session.id}/reload`)
    assert.equal(reload.status, 200)
    assert.equal(reload.json.state, "running")
    assert.equal(reload.json.machine_id, session.machine_id, "identity persists")
    assert.equal((await sh(session.id, "cat /root/h4a-disk")).out, "kept\n")
  })

  test("an unknown idle tier is a 400", async () => {
    const { status } = await call("POST", `/v1/sessions/${session.id}/idle`, { tier: "freezer" })
    assert.equal(status, 400)
  })

  test("publish serves the tree at /s/<id>/ and <id>.localhost", async () => {
    await sh(session.id, "mkdir -p /root/site/blog && echo '<h1>hi</h1>' > /root/site/index.html && echo post > /root/site/blog/hello.html")
    const published = await call("POST", `/v1/sessions/${session.id}/publish`, {})
    assert.equal(published.status, 200, published.text)
    assert.equal(published.json.url, `/s/${session.id}/`)
    assert.equal(published.json.files, 2)

    const index = await call("GET", `/s/${session.id}/`)
    assert.equal(index.status, 200)
    assert.match(index.type, /text\/html/)
    assert.equal(index.text, "<h1>hi</h1>\n")
    assert.equal((await call("GET", `/s/${session.id}/blog/hello`)).text, "post\n", "pretty links")
    assert.equal((await call("GET", `/s/${session.id}/missing.css`)).status, 404)

    const port = new URL(API).port
    const vhost = execFileSync("curl", ["-s", "-H", `Host: ${session.id}.localhost:${port}`, `${API}/`]).toString()
    assert.equal(vhost, "<h1>hi</h1>\n")
  })

  test("publish refuses relative and climbing paths", async () => {
    for (const path of ["site", "/root/../etc", 5]) {
      const { status } = await call("POST", `/v1/sessions/${session.id}/publish`, { path })
      assert.equal(status, 400, String(path))
    }
    const missing = await call("POST", `/v1/sessions/${session.id}/publish`, { path: "/nope" })
    assert.equal(missing.status, 400)
  })

  test("a published path cannot leave the site", async () => {
    const out = execFileSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "--path-as-is",
      `${API}/s/${session.id}/../../etc/passwd`]).toString()
    assert.notEqual(out, "200")
  })

  test("the trace records what happened, oldest first", async () => {
    const { json } = await call("GET", `/v1/sessions/${session.id}/trace`)
    const events = json.events.map((e) => e.event)
    for (const event of ["idle", "reload", "publish"]) assert.ok(events.includes(event), event)
    const times = json.events.map((e) => e.ts)
    assert.deepEqual(times, [...times].sort())
  })

  test("export leaves it stopped; restore makes a new identity with the files", async () => {
    const manifest = await call("POST", `/v1/sessions/${session.id}/export`)
    assert.equal(manifest.status, 200, manifest.text)
    assert.equal(manifest.json.schema, 1)
    assert.equal(manifest.json.id, session.id)
    assert.match(manifest.json.artifacts.sha256, /^[0-9a-f]{64}$/)
    assert.equal((await call("GET", `/v1/sessions/${session.id}`)).json.state, "stopped")

    const exports = await call("GET", "/v1/exports")
    assert.ok(exports.json.exports.some((e) => e.id === session.id))

    const copy = await create({ restore_from: session.id })
    assert.notEqual(copy.id, session.id)
    assert.notEqual(copy.machine_id, session.machine_id)
    assert.equal((await sh(copy.id, "cat /root/h4a-disk")).out, "kept\n")
    const trace = await call("GET", `/v1/sessions/${copy.id}/trace`)
    const events = trace.json.events.map((e) => e.event)
    assert.ok(events.includes("publish"), "the source's trace came along")
    assert.ok(events.includes("restore"))
  })

  test("destroy is a 204 and the session and site are gone", async () => {
    const gone = await destroy(session.id)
    assert.equal(gone.status, 204)
    assert.equal(gone.text, "")
    assert.equal((await call("GET", `/v1/sessions/${session.id}`)).status, 404)
    assert.equal((await call("GET", `/s/${session.id}/`)).status, 404)
  })
})

describe("terminal", () => {
  test("a websocket without a session is a 400", () => {
    const status = execFileSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}",
      "-H", "Upgrade: websocket", "-H", "Connection: Upgrade", "-H", "Sec-WebSocket-Key: x",
      `${TERM_URL}/pty`]).toString()
    assert.equal(status, "400")
  })

  test("a terminal opens and draws", async () => {
    const session = await create()
    const text = await terminal(session.id, /\S/)
    assert.match(text, /\S/)
    await destroy(session.id)
  })
})

// A websocket to the session's terminal. Frames are the guest's
// `{"op": "data", "data_b64"}` lines; resolves with the decoded text once
// `until` matches, leaving the socket open when `keep` is set.
function terminal(id, until, { keep = false, ms = 30000 } = {}) {
  const ws = new WebSocket(`${TERM_URL.replace(/^http/, "ws")}/pty?session=${id}&cols=80&rows=24`)
  ws.binaryType = "arraybuffer"
  let raw = ""
  let text = ""
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.close(); reject(new Error(`no ${until} in: ${text.slice(-300)}`)) }, ms)
    ws.onerror = () => { clearTimeout(timer); reject(new Error("websocket failed")) }
    ws.onmessage = (event) => {
      raw += typeof event.data === "string" ? event.data : Buffer.from(event.data).toString()
      for (const match of raw.matchAll(/"data_b64":\s*"([^"]*)"/g)) text += Buffer.from(match[1], "base64").toString()
      raw = raw.slice(raw.lastIndexOf("}") + 1)
      if (until.test(text)) {
        clearTimeout(timer)
        if (!keep) ws.close()
        resolve(keep ? { text, ws } : text)
      }
    }
  })
}

describe("h3 lessons", () => {
  test("destroy with a terminal attached finishes", async () => {
    const session = await create()
    const { ws } = await terminal(session.id, /\S/, { keep: true })
    const started = Date.now()
    const gone = await destroy(session.id)
    ws.close()
    assert.equal(gone.status, 204, gone.text)
    assert.ok(Date.now() - started < 15000, `destroy took ${Date.now() - started}ms`)
    const list = await call("GET", "/v1/sessions")
    assert.ok(!list.json.sessions.some((s) => s.id === session.id), "no orphan")
  })

  test("a hard stop keeps every file written before it", async () => {
    const session = await create()
    const count = 3000
    await sh(session.id, `mkdir -p /root/h4a && cd /root/h4a && i=0; while [ $i -lt ${count} ]; do echo $i > f$i; i=$((i+1)); done`, 120)
    // What a host crash looks like: the VM process dies, no idle, no sync.
    execFileSync("sh", ["-c", KILL.replaceAll("{pid}", String(session.pid))], { stdio: "ignore" })
    const reload = await call("POST", `/v1/sessions/${session.id}/reload`)
    assert.equal(reload.status, 200, reload.text)
    const empty = await sh(session.id, `cd /root/h4a || exit 9; ls | wc -l; find . -type f -empty | wc -l`)
    assert.equal(empty.code, 0, "/root/h4a survived the stop")
    const [files, blank] = empty.out.trim().split(/\s+/).map(Number)
    assert.equal(files, count, "every file exists")
    assert.equal(blank, 0, "no file lost its contents")
    await destroy(session.id)
  })

  test.todo("pi exits promptly after a -p reply (needs a model call)")
  test.todo("the page gets Pi's first draw after a cold boot (needs the browser page)")
})
