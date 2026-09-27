import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"
import { terminal_auth } from "../src/terminal-auth.js"

const secret = "terminal-auth-test-secret-at-least-thirty-two-bytes"
const phone = "+14155550123"
let clock = 1000000
const auth = terminal_auth(secret, { now: () => clock })
const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone, exp: Math.floor(clock / 1000) + 240 })).toString("base64url")
const pass = `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`

test("a verified pass becomes an expiring browser cookie", () => {
  assert.throws(() => auth.cookie("forged"))
  const cookie = auth.cookie(pass)
  assert.equal(auth.owner(`${auth.cookie_name}=${cookie}`), phone)
  assert.equal(auth.owner(`${auth.cookie_name}=${cookie}x`), null)
  clock += auth.cookie_age * 1000
  assert.equal(auth.owner(`${auth.cookie_name}=${cookie}`), null)
  clock = 1000000
})

test("tickets are actor-bound, one-use, and short-lived", () => {
  const wrong = auth.issue(phone, "a-one")
  assert.equal(auth.consume(wrong, phone, "a-two"), false)
  assert.equal(auth.consume(wrong, phone, "a-one"), false)
  const stolen = auth.issue(phone, "a-one")
  assert.equal(auth.consume(stolen, "+14155559999", "a-one"), false)
  const good = auth.issue(phone, "a-one")
  assert.equal(auth.consume(good, phone, "a-one"), true)
  assert.equal(auth.consume(good, phone, "a-one"), false)
  const expired = auth.issue(phone, "a-one")
  clock += 30001
  assert.equal(auth.consume(expired, phone, "a-one"), false)
})
