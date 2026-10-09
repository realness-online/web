#!/usr/bin/env node
// r4 done-when, live: through the host's engine, a busy page and a pinned doc
// get different cache times, and each read logs the rule that set its time.
//
// Needs the local host (`webspace local host up`).
//
//   node --test tools/control/test/web-times.check.js

import { createHmac as create_hmac } from "node:crypto"
import { execFileSync as exec_file_sync } from "node:child_process"
import { existsSync as exists_sync, readFileSync as read_file_sync } from "node:fs"
import assert from "node:assert/strict"
import { after, test } from "node:test"
import { out_path } from "#root/lib/output.js"

const API = process.env.API ?? "http://127.0.0.1:18080"
const owner = "+14156667777"
const secret_path = out_path("host-pass-secret")
const secret = process.env.HOST_PASS_SECRET ?? (exists_sync(secret_path) ? read_file_sync(secret_path, "utf8").trim() : null)
const BUSY = "https://news.ycombinator.com/"
const PINNED = "https://github.com/earendil-works/pi/blob/v1.0.2/README.md"
const made = new Set()

const pass = () => {
  const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone: owner, exp: Math.floor(Date.now() / 1000) + 240 })).toString("base64url")
  return `${body}.${create_hmac("sha256", secret).update(body).digest("base64url")}`
}
const call = async (method, path, body) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${pass()}`, ...(body && { "content-type": "application/json" }) },
    ...(body && { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  return { status: response.status, text, json: text.startsWith("{") ? JSON.parse(text) : undefined }
}
// The engine's own log on the host, read over the Lima shell (local only).
const engine_log = () =>
  exec_file_sync("limactl", ["shell", "--workdir", "/", "fc-local", "--", "sudo", "sh", "-c", "cat /opt/fc/actors/mnt/web-cache/log/*.jsonl"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l))

after(async () => {
  for (const id of made) await call("DELETE", `/v1/actors/${id}`).catch(() => {})
})

test("a busy page and a pinned doc get different times through the engine", { timeout: 600_000 }, async () => {
  assert.ok(secret, "HOST_PASS_SECRET or artifacts/brayness/host-pass-secret required")
  const actor = await call("POST", "/v1/actors", {})
  assert.equal(actor.status, 201, actor.text)
  made.add(actor.json.id)
  const { createHash } = await import("node:crypto")
  const rows = []
  for (const url of [BUSY, PINNED]) {
    const result = await call("POST", `/v1/actors/${actor.json.id}/exec`, { argv: ["sh", "-c", `brayness-read '${url}' --fresh | head -c 200`], timeout: 240 })
    assert.equal(result.json.exit_code, 0, Buffer.from(result.json.stderr_b64, "base64").toString())
    const line = engine_log().filter((l) => l.url === createHash("sha256").update(url).digest("hex")).at(-1)
    rows.push({ url, source: line.outcome, ttl_h: line.ttl_h, why: line.why, shared: line.shared })
  }
  console.table(rows)
  assert.deepEqual([rows[0].why, rows[0].ttl_h], ["front page or listing", 0.25])
  assert.equal(rows[1].why === "pinned version" || rows[1].why === "max-age", true)
  assert.notEqual(rows[0].ttl_h, rows[1].ttl_h)
  assert.deepEqual(rows.map((r) => r.shared), [true, true], "anonymous private pages are shared")
})
