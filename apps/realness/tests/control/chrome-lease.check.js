#!/usr/bin/env node

import { createHmac as create_hmac } from 'node:crypto'
import {
  existsSync as exists_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { out_path } from '#root/lib/output.js'

const API = process.env.API ?? 'http://127.0.0.1:18080'
const owner = '+14156667777'
const secret_path = out_path('host-pass-secret')
const secret =
  process.env.HOST_PASS_SECRET ??
  (exists_sync(secret_path) ? read_file_sync(secret_path, 'utf8').trim() : null)
const made = new Set()

const pass = () => {
  const body = Buffer.from(
    JSON.stringify({
      aud: 'realness-host',
      phone: owner,
      exp: Math.floor(Date.now() / 1000) + 240
    })
  ).toString('base64url')
  return `${body}.${create_hmac('sha256', secret).update(body).digest('base64url')}`
}
const call = async (method, path, body) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${pass()}`,
      ...(body && { 'content-type': 'application/json' })
    },
    ...(body && { body: JSON.stringify(body) })
  })
  const text = await response.text()
  return {
    status: response.status,
    text,
    json: text.startsWith('{') ? JSON.parse(text) : undefined
  }
}
const create = async () => {
  const result = await call('POST', '/v1/actors', {})
  assert.equal(result.status, 201, result.text)
  made.add(result.json.id)
  return result.json
}
const sh = async (id, command, timeout = 240) => {
  const result = await call('POST', `/v1/actors/${id}/exec`, {
    argv: ['/bin/sh', '-c', command],
    timeout
  })
  assert.equal(result.status, 200, result.text)
  return {
    code: result.json.exit_code,
    out: Buffer.from(result.json.stdout_b64, 'base64').toString().trim(),
    err: Buffer.from(result.json.stderr_b64, 'base64').toString().trim()
  }
}
const address = tap => `172.16.${/\d+$/.exec(tap)[0]}.2`

const open_in_chrome = (devtools, url) => `node -e '
const [devtools, url] = process.argv.slice(1)
const { webSocketDebuggerUrl } = await (await fetch(devtools + "/json/version")).json()
const ws = new WebSocket(webSocketDebuggerUrl)
await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no })
let id = 0; const waiting = new Map(); const events = []
ws.onmessage = ({ data }) => { const m = JSON.parse(data); if (m.id) waiting.get(m.id)?.(m); else events.push(m) }
const send = (method, params = {}, sessionId) => new Promise((ok) => { waiting.set(++id, ok); ws.send(JSON.stringify({ id, method, params, sessionId })) })
const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" })
const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true })
await send("Page.enable", {}, sessionId)
await send("Page.navigate", { url }, sessionId)
const end = Date.now() + 60000
while (!events.some((e) => e.method === "Page.loadEventFired") && Date.now() < end) await new Promise((r) => setTimeout(r, 50))
const { result } = await send("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true }, sessionId)
console.log(result.result.value)
process.exit(0)
' --input-type=module ${devtools} ${url}`

after(async () => {
  for (const id of made)
    await call('DELETE', `/v1/actors/${id}`).catch(() => {})
})

test(
  "a leased Chrome opens the actor's own dev server; others cannot reach it",
  { timeout: 600_000 },
  async () => {
    assert.ok(
      secret,
      'HOST_PASS_SECRET or artifacts/realness/host-pass-secret required'
    )
    const [actor, other] = await Promise.all([create(), create()])
    const marker = `c2-dev-server-${Date.now()}`

    const served = await sh(
      actor.id,
      `mkdir -p /srv/dev && echo '<html><body><h1>${marker}</h1></body></html>' > /srv/dev/index.html && (setsid python3 -m http.server 5173 --directory /srv/dev > /srv/dev/log 2>&1 &) && sleep 1 && echo started`
    )
    assert.equal(served.out, 'started', served.err)

    let clock = performance.now()
    const lease = await sh(actor.id, 'realness chrome')
    const lease_s = (performance.now() - clock) / 1000
    assert.equal(lease.code, 0, lease.err)
    const devtools = lease.out
    assert.match(devtools, /^http:\/\/172\.19\.\d+\.2:9222$/)
    console.log(`leased ${devtools} in ${lease_s.toFixed(1)}s (${lease.err})`)

    clock = performance.now()
    const page = await sh(
      actor.id,
      open_in_chrome(devtools, `http://${address(actor.tap)}:5173/`)
    )
    console.log(
      `dev server opened in ${((performance.now() - clock) / 1000).toFixed(1)}s`
    )
    assert.equal(page.code, 0, page.err)
    assert.match(
      page.out,
      new RegExp(marker),
      "the leased Chrome shows the actor's dev server"
    )

    const internet = await sh(
      actor.id,
      open_in_chrome(devtools, 'https://example.com/')
    )
    assert.match(
      internet.out,
      /documentation examples/,
      'the leased Chrome reaches the internet'
    )

    const intruder = await sh(
      other.id,
      `curl -s -m 5 -o /dev/null -w '%{http_code}' ${devtools}/json/version; echo`
    )
    assert.equal(
      intruder.out.replace(/\s/g, ''),
      '000',
      'another actor cannot reach the leased Chrome'
    )

    const returned = await sh(actor.id, 'realness chrome return')
    assert.equal(returned.out, 'returned', returned.err)
    const gone = await sh(
      actor.id,
      `curl -s -m 5 -o /dev/null -w '%{http_code}' ${devtools}/json/version; echo`
    )
    assert.equal(
      gone.out.replace(/\s/g, ''),
      '000',
      'a returned Chrome is gone'
    )
  }
)
