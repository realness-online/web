#!/usr/bin/env node
import { createHmac as create_hmac } from "node:crypto"
import { existsSync as exists_sync, readFileSync as read_file_sync } from "node:fs"
import { out_path } from "#root/lib/output.js"

const API = process.env.API ?? "http://127.0.0.1:18080"
const owner = "+14156667777"
const secret_path = out_path("host-pass-secret")
const secret = process.env.HOST_PASS_SECRET ?? (exists_sync(secret_path) ? read_file_sync(secret_path, "utf8").trim() : null)
const reply_limit_ms = Number(process.env.PI_REPLY_LIMIT_MS ?? 120000)
const exit_limit_ms = Number(process.env.PI_EXIT_LIMIT_MS ?? 5000)

const host_pass = () => {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("HOST_PASS_SECRET required for check:pi-exit")
  const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone: owner, exp: Math.floor(Date.now() / 1000) + 240 })).toString("base64url")
  return `${body}.${create_hmac("sha256", secret).update(body).digest("base64url")}`
}

const request = async (path, options = {}) => {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...options.headers, authorization: `Bearer ${host_pass()}` },
  })
  const body = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(body)}`)
  return body
}

const main = async () => {
  const health = await request("/v1/health")
  if (!health.seed?.matches) throw new Error("host seed is not ready")
  let actor
  try {
    actor = (await request("/v1/actors", { method: "POST" })).id
    const started = Date.now()
    const result = await request(`/v1/actors/${actor}/exec`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        argv: ["/usr/local/bin/brayness", "--mode", "json", "--no-session", "--no-tools", "--no-skills", "--no-context-files", "Reply with exactly: ready"],
        cwd: "/brayness",
        timeout: Math.ceil((reply_limit_ms + exit_limit_ms) / 1000),
      }),
      signal: AbortSignal.timeout(reply_limit_ms + exit_limit_ms + 10000),
    })
    const elapsed = Date.now() - started
    const output = Buffer.from(result.stdout_b64, "base64").toString()
    const error = Buffer.from(result.stderr_b64, "base64").toString()
    if (result.exit_code !== 0) throw new Error(`Pi or model failed (exit ${result.exit_code}): ${error.slice(-400)}`)
    const events = output.trim().split("\n").map((line) => JSON.parse(line))
    const reply = events.findLast((event) => event.type === "message_end" && event.message?.role === "assistant")
    if (reply?.message?.stopReason !== "stop" || !reply.message.content?.some((block) => block.type === "text" && block.text.trim() === "ready")) {
      throw new Error(`no completed model reply: ${output.slice(-400)} ${error.slice(-200)}`)
    }
    if (!events.some((event) => event.type === "agent_settled")) throw new Error("Pi did not settle")
    if (elapsed > reply_limit_ms + exit_limit_ms) throw new Error(`Pi exited too late: ${elapsed}ms`)
    console.log(`Pi replied and exited in ${elapsed}ms`)
  } finally {
    if (actor) await request(`/v1/actors/${actor}`, { method: "DELETE" })
  }
}

main().catch((error) => {
  console.error(`check:pi-exit: ${error.message}`)
  process.exitCode = 1
})
