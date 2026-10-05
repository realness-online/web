// o6 live: an admin's idle and stop requests reach a real dev host through sync.
// Needs `webspace dev host up` (with current host code) and `webspace dev admin login`.
//   npm run check:actor-request
import assert from "node:assert/strict"
import { createHmac as create_hmac } from "node:crypto"
import { readFileSync as read_file_sync } from "node:fs"
import { reader, actors, request_actor } from "../src/reads.js"

const API = process.env.API ?? "http://127.0.0.1:18080"
const owner = "+14156667777"
const secret = read_file_sync(new URL("../../dist/host-pass-secret", import.meta.url), "utf8").trim()
const pass = () => {
  const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone: owner, exp: Math.floor(Date.now() / 1000) + 240 })).toString("base64url")
  return `${body}.${create_hmac("sha256", secret).update(body).digest("base64url")}`
}
const call = async (method, path, body) => {
  const response = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${pass()}`, "content-type": "application/json" }, body: body && JSON.stringify(body) })
  assert.ok(response.ok, `${method} ${path}: ${response.status}`)
  return response.status === 204 ? null : response.json()
}
const sync = await reader("dev")
const wait_for = async (id, state) => {
  for (let i = 0; i < 40; i += 1) {
    const [actor] = await actors(sync, id).catch(() => [])
    if (actor?.state === state) return Date.now()
    await new Promise((done) => setTimeout(done, 3000))
  }
  throw new Error(`${id} never reported ${state}`)
}

const { id } = await call("POST", "/v1/actors", {})
console.log(`created ${id}`)
try {
  await wait_for(id, "running")
  console.log("host reports it running")
  let asked = Date.now()
  console.log(await request_actor(sync, id, "idle"))
  console.log(`idle obeyed in ${Math.round((await wait_for(id, "idle") - asked) / 1000)}s`)
  asked = Date.now()
  console.log(await request_actor(sync, id, "stop"))
  console.log(`stop obeyed in ${Math.round((await wait_for(id, "stopped") - asked) / 1000)}s`)
  assert.equal((await call("GET", `/v1/actors/${id}`)).state, "stopped")
  console.log("PASS: idle then stop reached the host through sync")
} finally {
  await call("DELETE", `/v1/actors/${id}`).catch((error) => console.log(`cleanup: ${error.message}`))
}
