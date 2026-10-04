// s1 live: a fresh actor on the dev host pulls saved files through a sync
// service and replays pending edits. Needs `webspace dev host up` and a
// template built with the current host/guest/brayness-recover.
import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { createHash, createHmac, randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { after, before, test } from "node:test"

const API = process.env.API ?? "http://127.0.0.1:18080"
const PORT = Number(process.env.SYNC_PORT ?? 18095)
const owner = "+14156667777"
const root = new URL("../..", import.meta.url).pathname // /mnt/fc inside Lima
const secret = readFileSync(join(root, "dist/host-pass-secret"), "utf8").trim()
const run = `fresh-actor-${randomUUID().slice(0, 8)}`
const data = join(root, "dist", run)
const hash = (text) => createHash("sha256").update(text).digest("hex")
const made = new Set()
let sync

function hostPass() {
  const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone: owner, exp: Math.floor(Date.now() / 1000) + 240 })).toString("base64url")
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`
}
async function call(method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${hostPass()}`, ...(body && { "content-type": "application/json" }) },
    body: body && JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, text, json: text.startsWith("{") ? JSON.parse(text) : undefined }
}
async function create(body = {}) {
  const result = await call("POST", "/v1/actors", body)
  assert.equal(result.status, 201, result.text)
  made.add(result.json.id)
  return result.json.id
}
async function sh(id, command) {
  const result = await call("POST", `/v1/actors/${id}/exec`, { argv: ["/bin/sh", "-c", command], timeout: 120 })
  assert.equal(result.status, 200, result.text)
  const text = (b64) => Buffer.from(b64, "base64").toString()
  return { code: result.json.exit_code, out: text(result.json.stdout_b64), err: text(result.json.stderr_b64) }
}
const put = (path, body) => {
  const file = join(data, "people", owner, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, body)
}
const recover = (id) => sh(id, `brayness-recover "http://$(ip route | awk '/default/{print $3; exit}'):${PORT}"`)

before(async () => {
  const call = { type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: "c1", name: "edit", arguments: { path: "doc.md", edits: [{ oldText: "body", newText: "BODY" }] } }] } }
  const at = (n) => new Date(Date.UTC(2026, 8, 27, 0, 0, n)).toISOString()
  const session = [
    { type: "session", version: 3, id: randomUUID(), timestamp: at(0), cwd: "/brayness" },
    { type: "message", id: "m0000001", parentId: null, timestamp: at(1), message: { role: "user", content: [{ type: "text", text: `remember ${run}` }], timestamp: Date.parse(at(1)) } },
    { type: "message", id: "m0000002", parentId: "m0000001", timestamp: at(2), ...call },
  ]
  put(".pi/agent/sessions/--brayness--/s.jsonl", `${session.map((entry) => JSON.stringify(entry)).join("\n")}\n`)
  put("vault/Projects/fresh.md", "# Fresh\n\n## Syncs\n\n- work/notes\n")
  put("work/notes/doc.md", "title\nbody\n")
  put("work/other/skip.md", "not declared")
  put("vault/limited.md", "for a limited actor")
  put(".pi/agent/auth.json", "SECRET")
  put(".pi/agent/deferred.json", JSON.stringify({
    "work/notes/doc.md": { base_sha: hash("title\nbody\n"), target_sha: hash("title\nBODY\n"), calls: [{ session: "--brayness--/s.jsonl", tool_call: "c1" }] },
  }))
  // Record the guest PID: stopping limactl leaves the guest process running.
  sync = spawn("limactl", ["shell", "fc-local", "--", "sh", "-c", `echo $$ > /mnt/fc/dist/${run}/sync.pid; exec env HOST_PASS_SECRET=${secret} LISTEN=0.0.0.0 PORT=${PORT} SYNC_DIR=/mnt/fc/dist/${run} node /mnt/fc/sync/bin/sync-service.js --dev`],
    { stdio: ["ignore", "pipe", "inherit"] })
  await new Promise((ready, fail) => {
    sync.stdout.on("data", (chunk) => chunk.toString().includes("# sync service on") && ready())
    sync.on("exit", (code) => fail(new Error(`sync service exited ${code}`)))
  })
})

after(async () => {
  for (const id of made) await call("DELETE", `/v1/actors/${id}`)
  const pid = readFileSync(join(data, "sync.pid"), "utf8").trim()
  if (/^\d+$/.test(pid)) spawnSync("limactl", ["shell", "fc-local", "--", "kill", pid], { stdio: "ignore" })
  sync?.kill()
  rmSync(data, { recursive: true, force: true })
})

test("a fresh actor pulls its owner's saved files and replays the pending edit", async () => {
  const id = await create()
  const result = await recover(id)
  assert.equal(result.code, 0, result.err)
  assert.match(result.out, /replayed 1 pending edits/)
  assert.equal((await sh(id, "cat /brayness/work/notes/doc.md")).out, "title\nBODY\n")
  // Pi itself parses the restored history; no model call.
  const opened = await sh(id, "cd /brayness && mkdir -p artifacts && pi --export .pi/agent/sessions/--brayness--/s.jsonl artifacts/history.html && python3 -c \"import base64, re; html = open('artifacts/history.html').read(); print(base64.b64decode(re.search(r'id=.session-data[^>]*>([^<]*)', html).group(1)).decode())\"")
  assert.equal(opened.code, 0, opened.err)
  assert.match(opened.out, new RegExp(run), "Pi opens the old history")
  assert.notEqual((await sh(id, "test -e /brayness/work/other/skip.md")).code, 0, "undeclared folders stay behind")
  assert.notEqual((await sh(id, "grep -q SECRET /brayness/.pi/agent/auth.json")).code, 0, "secrets never travel")
})

test("a limited actor pulls only its listed paths", async () => {
  const id = await create({ paths: ["vault/limited.md"] })
  const result = await recover(id)
  assert.equal(result.code, 0, result.err)
  assert.equal((await sh(id, "cat /brayness/vault/limited.md")).out, "for a limited actor")
  assert.notEqual((await sh(id, "test -e /brayness/work/notes/doc.md")).code, 0)
})

test("the host refuses a path list that names secrets", async () => {
  const result = await call("POST", "/v1/actors", { paths: [".pi/agent/auth.json"] })
  assert.equal(result.status, 400, result.text)
})
