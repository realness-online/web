// k1's check, on a running host: a fresh actor runs every shipped skill's
// check as its own user, then goes away. The template build runs the same
// checks in its tree and refuses to finish when one fails; this proves them
// in a real microVM.
//
//   sudo -E node server/host/checks/skills.check.js        API on 127.0.0.1:8080
//   API=http://127.0.0.1:18080 ...                    the local host
//
// Needs HOST_PASS_SECRET (sudo -E keeps it). Exits 1 on any failure.

import assert from "node:assert/strict"
import { issue_host_pass } from "#root/lib/sign-on/src/node/host-pass.js"

const API = process.env.API ?? "http://127.0.0.1:8080"
const owner = process.env.OWNER ?? "+14156667777"
const secret = process.env.HOST_PASS_SECRET
assert.ok(secret, "HOST_PASS_SECRET is not set")

const call = async (method, path, body) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${issue_host_pass({ phone: owner }, secret)}`, ...(body && { "content-type": "application/json" }) },
    body: body && JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, text, json: text.startsWith("{") ? JSON.parse(text) : undefined }
}

const made = await call("POST", "/v1/actors", {})
assert.equal(made.status, 201, made.text)
const id = made.json.id
try {
  const command = "cd /brayness && node bin/check-skills.js --run"
  const result = await call("POST", `/v1/actors/${id}/exec`, {
    argv: ["runuser", "-u", "brayness", "--", "env", "HOME=/brayness", "PATH=/usr/local/bin:/usr/bin:/bin", "sh", "-c", command],
    timeout: 300,
  })
  assert.equal(result.status, 200, result.text)
  const out = Buffer.from(result.json.stdout_b64, "base64").toString() + Buffer.from(result.json.stderr_b64, "base64").toString()
  console.log(out.trim())
  assert.equal(result.json.exit_code, 0, "a shipped skill's check failed in the actor")
  console.log(`PASS: every shipped skill's check passes in actor ${id}`)
} finally {
  await call("DELETE", `/v1/actors/${id}`)
}
