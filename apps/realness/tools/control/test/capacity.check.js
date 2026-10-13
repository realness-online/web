import assert from "node:assert/strict"
import { createHmac as create_hmac } from "node:crypto"
import { readFileSync as read_file_sync } from "node:fs"
import { out_path } from "#root/lib/output.js"

const API = process.env.API ?? "http://127.0.0.1:18080"
const owner = "+14156667777"
const LIMIT = Number(process.env.CAP_LIMIT ?? 64)
const secret = read_file_sync(out_path("host-pass-secret"), "utf8").trim()
const pass = () => {
  const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone: owner, exp: Math.floor(Date.now() / 1000) + 240 })).toString("base64url")
  return `${body}.${create_hmac("sha256", secret).update(body).digest("base64url")}`
}
const call = async (method, path, body) => {
  const response = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${pass()}`, "content-type": "application/json" }, body: body && JSON.stringify(body) })
  const text = await response.text()
  const parsed = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${parsed?.error ?? text}`)
  return parsed
}

const made = []
let failure = null
let started = Date.now()
console.log(`creating actors up to ${LIMIT} against ${API}`)
for (let n = 1; n <= LIMIT; n += 1) {
  const at = Date.now()
  try {
    const { id } = await call("POST", "/v1/actors", {})
    made.push(id)
    const ms = Date.now() - at
    console.log(`${String(n).padStart(3)}  ${id}  ${ms}ms`)
  } catch (error) {
    failure = { n, message: error.message }
    console.log(`${String(n).padStart(3)}  FAILED  ${error.message}`)
    break
  }
}

const total = Math.round((Date.now() - started) / 1000)
const health = await call("GET", "/v1/health").catch(() => null)
console.log(`\ncreated ${made.length} actors in ${total}s`)
console.log(`health: ${JSON.stringify(health?.host ?? health).slice(0, 300)}`)
if (failure) console.log(`first failure at actor ${failure.n}: ${failure.message}`)
else console.log(`no failure before the ${LIMIT} cap; raise CAP_LIMIT`)

console.log("\ndestroying what it made")
for (const id of made.reverse()) await call("DELETE", `/v1/actors/${id}`).catch((error) => console.log(`cleanup ${id}: ${error.message}`))
console.log(`destroyed ${made.length}`)
assert.ok(made.length > 0, "at least one actor must be created for this to measure anything")
