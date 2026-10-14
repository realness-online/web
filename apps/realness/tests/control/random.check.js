import assert from 'node:assert/strict'
import { createHmac as create_hmac } from 'node:crypto'
import { readFileSync as read_file_sync } from 'node:fs'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { out_path } from '#root/lib/output.js'

const API = process.env.API ?? 'http://127.0.0.1:18080'
const owner = '+14156667777'
const root = new URL('../..', import.meta.url).pathname
const secret = read_file_sync(out_path('host-pass-secret'), 'utf8').trim()
const made = []

const hostPass = () => {
  const body = Buffer.from(
    JSON.stringify({
      aud: 'brayness-host',
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
      authorization: `Bearer ${hostPass()}`,
      ...(body && { 'content-type': 'application/json' })
    },
    body: body && JSON.stringify(body)
  })
  const text = await response.text()
  return {
    status: response.status,
    text,
    json: text.startsWith('{') ? JSON.parse(text) : undefined
  }
}
const sh = async (id, command) => {
  const result = await call('POST', `/v1/actors/${id}/exec`, {
    argv: ['/bin/sh', '-c', command],
    timeout: 120
  })
  assert.equal(result.status, 200, result.text)
  return Buffer.from(result.json.stdout_b64, 'base64').toString().trim()
}

const PROBE = [
  "head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \\n'; echo",
  'for i in $(seq 900); do [ -s /run/brayness/pi-random ] && break; sleep 0.1; done',
  'pgrep -x pi | wc -l',
  'cat /run/brayness/pi-random 2>/dev/null || echo none'
].join('; ')

after(async () => {
  for (const id of made) await call('DELETE', `/v1/actors/${id}`)
})

test('two actors from one seed draw different randomness', async () => {
  const ids = []
  for (let i = 0; i < 2; i++) {
    const result = await call('POST', '/v1/actors', {})
    assert.equal(result.status, 201, result.text)
    made.push(result.json.id)
    ids.push(result.json.id)
  }
  const [a, b] = await Promise.all(
    ids.map(id => sh(id, PROBE).then(out => out.split('\n')))
  )
  console.log(JSON.stringify({ a, b }, null, 2))
  assert.notEqual(a[0], b[0], 'kernel urandom repeats across clones')
  assert.equal(a[1], '1', 'actor a runs one Pi')
  assert.equal(b[1], '1', 'actor b runs one Pi')
  assert.ok(a[2] !== 'none' && b[2] !== 'none', 'pi wrote no random probe')
  assert.notEqual(
    a[2],
    b[2],
    "pi's in-process randomness repeats across clones"
  )
})
