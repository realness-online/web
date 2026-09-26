import { test } from "node:test"
import assert from "node:assert/strict"
import { createSign, generateKeyPairSync } from "node:crypto"
import { google_certs, identify, pin, verify_token } from "../src/identity.js"

const project = "realness-test"
const now = 1_760_000_000
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const { privateKey: forger } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const certs = async () => ({ k1: publicKey.export({ type: "spki", format: "pem" }) })

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url")
function sign(claims = {}, { key = privateKey, header = {} } = {}) {
  const head = b64({ alg: "RS256", kid: "k1", typ: "JWT", ...header })
  const body = b64({
    aud: project,
    iss: `https://securetoken.google.com/${project}`,
    sub: "uid-1",
    phone_number: "+14155550001",
    iat: now - 10,
    auth_time: now - 10,
    exp: now + 3600,
    ...claims,
  })
  const signer = createSign("RSA-SHA256")
  signer.update(`${head}.${body}`)
  return `${head}.${body}.${signer.sign(key).toString("base64url")}`
}
const verify = (token) => verify_token(token, { project, certs, now })

test("a good token yields uid and phone", async () => {
  assert.deepEqual(await verify(sign()), { uid: "uid-1", phone: "+14155550001" })
})

test("bad tokens throw", async () => {
  const bad = {
    garbage: "not.a.jwt",
    empty: "",
    forged: sign({}, { key: forger }),
    unknown_key: sign({}, { header: { kid: "k2" } }),
    none_alg: sign({}, { header: { alg: "none" } }),
    other_project: sign({ aud: "someone-else" }),
    other_issuer: sign({ iss: "https://securetoken.google.com/someone-else" }),
    expired: sign({ exp: now - 1 }),
    expiring_now: sign({ exp: now }),
    proto_key: sign({}, { header: { kid: "__proto__" } }),
    future: sign({ iat: now + 3600 }),
    no_uid: sign({ sub: "" }),
    no_phone: sign({ phone_number: undefined }),
    email_only: sign({ phone_number: "scott@example.com" }),
  }
  for (const [name, token] of Object.entries(bad)) {
    await assert.rejects(verify(token), undefined, name)
  }
  const [head, , signature] = sign().split(".")
  const swapped = `${head}.${b64({ sub: "uid-2", phone_number: "+14155550002" })}.${signature}`
  await assert.rejects(verify(swapped), /signature/)
})

// A create-if-absent put: the first uid to claim a number keeps it.
const memory_pins = () => {
  const store = new Map()
  return {
    claim: async (phone, uid) => {
      if (!store.has(phone)) store.set(phone, uid)
      return store.get(phone)
    },
  }
}

test("a recycled number with a new uid is refused", async () => {
  const pins = memory_pins()
  assert.deepEqual(await pin({ uid: "uid-1", phone: "+14155550001" }, pins), { phone: "+14155550001" })
  assert.deepEqual(await pin({ uid: "uid-1", phone: "+14155550001" }, pins), { phone: "+14155550001" })
  await assert.rejects(pin({ uid: "uid-9", phone: "+14155550001" }, pins), /another uid/)
})

test("two first sign-ins race; one uid wins the number", async () => {
  const pins = memory_pins()
  const results = await Promise.allSettled([
    pin({ uid: "uid-1", phone: "+14155550001" }, pins),
    pin({ uid: "uid-2", phone: "+14155550001" }, pins),
  ])
  assert.deepEqual(results.map((r) => r.status).sort(), ["fulfilled", "rejected"])
})

test("identify turns a token into a can() subject", async () => {
  const pins = memory_pins()
  assert.deepEqual(await identify(sign(), { project, certs, now, pins }), { phone: "+14155550001" })
  await assert.rejects(identify(sign({ sub: "uid-9" }), { project, certs, now, pins }), /another uid/)
  await assert.rejects(identify(sign({ exp: now - 1 }), { project, certs, now, pins }), /expired/)
})

test("certs are cached for their max-age", async () => {
  let calls = 0
  const fetcher = async () => {
    calls++
    return { ok: true, headers: new Headers({ "cache-control": "public, max-age=600" }), json: async () => ({ k: "pem" }) }
  }
  const get = google_certs(fetcher)
  await get()
  await get()
  assert.equal(calls, 1)
})
