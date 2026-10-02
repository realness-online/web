#!/usr/bin/env node
// b1c: the chat page's /chat/limit reaches the proxy under the actor's pass.
// Run with a dev host: npm run check:chat-limit
import { createHmac } from "node:crypto"
import { readFileSync } from "node:fs"

const API = process.env.API ?? "http://127.0.0.1:18080"
const WEB = process.env.WEB ?? "http://127.0.0.1:18090"
const owner = "+14156667777"
const secret = process.env.HOST_PASS_SECRET ?? readFileSync(new URL("../../dist/host-pass-secret", import.meta.url), "utf8").trim()
const pass = () => {
  const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone: owner, exp: Math.floor(Date.now() / 1000) + 240 })).toString("base64url")
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`
}
const api = async (path, options = {}) => {
  const response = await fetch(`${API}${path}`, { ...options, headers: { authorization: `Bearer ${pass()}` } })
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return response.status === 204 ? null : response.json()
}

let actor
try {
  actor = (await api("/v1/actors", { method: "POST" })).id
  const auth = await fetch(`${WEB}/auth`, { method: "POST", headers: { origin: WEB }, body: JSON.stringify({ pass: pass() }) })
  const cookie = auth.headers.get("set-cookie")?.split(";")[0]
  if (!cookie) throw new Error(`auth: ${auth.status}`)
  const reply = await fetch(`${WEB}/chat/limit?actor=${actor}`, { headers: { cookie } })
  const status = await reply.json()
  if (reply.status !== 200 || !status.free?.day) throw new Error(`chat limit: ${reply.status} ${JSON.stringify(status)}`)
  console.log(`PASS: chat limit says ${status.plan}, ${status.free.day.used} of ${status.free.day.limit} tokens today, warn ${status.warn ? status.warn.percent + "%" : "none"}`)
} finally {
  if (actor) await api(`/v1/actors/${actor}`, { method: "DELETE" })
}
