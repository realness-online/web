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
const secret_path = out_path('halo-pass-secret')
const secret =
  process.env.HALO_PASS_SECRET ??
  (exists_sync(secret_path) ? read_file_sync(secret_path, 'utf8').trim() : null)
const made = new Set()
const PAGES = (
  process.env.PAGES ??
  'https://nodejs.org/api/fs.html https://quotes.toscrape.com/js/'
).split(' ')

const pass = () => {
  const body = Buffer.from(
    JSON.stringify({
      aud: 'realness-halo',
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
const web_md = async (id, url, extra = '') => {
  const command = `cd /realness && node .pi/bin/web/web-md.js '${url}' --max 300 ${extra}`
  const result = await call('POST', `/v1/actors/${id}/exec`, {
    argv: [
      'runuser',
      '-u',
      'realness',
      '--',
      'env',
      'HOME=/realness',
      'PATH=/usr/local/bin:/usr/bin:/bin',
      'sh',
      '-c',
      command
    ],
    timeout: 240
  })
  assert.equal(result.status, 200, result.text)
  const out = Buffer.from(result.json.stdout_b64, 'base64').toString()
  const err = Buffer.from(result.json.stderr_b64, 'base64').toString()
  return {
    code: result.json.exit_code,
    out,
    err,
    source: /<!-- \S+ \| ([^|]+?) \|/.exec(out)?.[1] ?? null
  }
}

after(async () => {
  for (const id of made)
    await call('DELETE', `/v1/actors/${id}`).catch(() => {})
})

test(
  "the second actor's read skips rendering; the hit rate is measured",
  { timeout: 900_000 },
  async () => {
    assert.ok(
      secret,
      'HALO_PASS_SECRET or artifacts/realness/halo-pass-secret required'
    )
    const [first, second] = await Promise.all([create(), create()])
    const rows = []
    for (const url of PAGES) {
      const fresh = await web_md(first.id, url, '--fresh')
      assert.equal(fresh.code, 0, fresh.err)
      assert.match(
        fresh.source,
        /^engine (static|chrome|firecrawl)$/,
        fresh.out.slice(0, 300)
      )
      let clock = performance.now()
      const again = await web_md(second.id, url)
      const again_s = (performance.now() - clock) / 1000
      assert.equal(again.code, 0, again.err)
      assert.match(
        again.source,
        /^engine cache /,
        `${url}: the second actor read from the shared cache`
      )
      rows.push({
        url,
        first: fresh.source,
        second: again.source,
        second_s: Number(again_s.toFixed(2))
      })
    }
    console.table(rows)
    assert.ok(
      rows.some(r => r.first === 'engine chrome'),
      'a JavaScript-only page rendered in a Chrome copy'
    )
  }
)
