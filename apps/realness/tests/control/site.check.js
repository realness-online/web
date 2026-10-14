#!/usr/bin/env node
import { createHmac as create_hmac } from 'node:crypto'
import { readFileSync as read_file_sync } from 'node:fs'
import { out_path } from '#root/lib/output.js'

const api = process.env.API ?? 'http://127.0.0.1:18080'
const phone = '+14156667777'
const secret =
  process.env.HOST_PASS_SECRET ??
  read_file_sync(out_path('host-pass-secret'), 'utf8').trim()
const body = Buffer.from(
  JSON.stringify({
    aud: 'brayness-host',
    phone,
    exp: Math.floor(Date.now() / 1000) + 240
  })
).toString('base64url')
const pass = `${body}.${create_hmac('sha256', secret).update(body).digest('base64url')}`
const sync_port = Number(process.env.SYNC_SITE_PORT ?? 18096)

const request = async (path, options = {}) => {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: { ...options.headers, authorization: `Bearer ${pass}` }
  })
  if (!response.ok)
    throw new Error(`${path}: ${response.status} ${await response.text()}`)
  return response.status === 204 ? null : response.json()
}
const create = async () => (await request('/v1/actors', { method: 'POST' })).id
const run = async (actor, argv) => {
  const result = await request(`/v1/actors/${actor}/exec`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ argv, timeout: 120 })
  })
  const output = Buffer.from(result.stdout_b64, 'base64').toString()
  if (result.exit_code)
    throw new Error(`${argv[0]}: ${Buffer.from(result.stderr_b64, 'base64')}`)
  return output
}
const content = async url => await (await fetch(url)).text()
let actor, next
try {
  actor = await create()
  let site
  for (const text of ['first', 'second']) {
    await run(actor, [
      '/bin/sh',
      '-c',
      `mkdir -p /brayness/work/site; printf '%s' '${text}' > /brayness/work/site/index.html`
    ])
    const published = await run(actor, [
      '/usr/local/bin/brayness-publish',
      '/brayness/work/site'
    ])
    const url = published.trim().split('\n').at(-1)
    if (!url.startsWith('http'))
      throw new Error(`publish did not return URL: ${published}`)
    if (site && url !== site) throw new Error('revision changed the site URL')
    site = url
    if ((await content(site)) !== text)
      throw new Error('published site has wrong content')
  }
  const versions = await run(actor, [
    '/usr/local/bin/brayness-site',
    'versions'
  ])
  const version = versions.split(' ')[0]
  if (!/^[a-f0-9]{12}$/.test(version))
    throw new Error(`missing version: ${versions}`)
  await run(actor, ['/usr/local/bin/brayness-site', 'restore', version])
  if ((await content(site)) !== 'first')
    throw new Error('restore did not return the first site')

  await request(`/v1/actors/${actor}`, { method: 'DELETE' })
  actor = null
  if ((await content(site)) !== 'first')
    throw new Error('site disappeared after actor deletion')
  next = await create()
  const recovered = await run(next, [
    '/bin/sh',
    '-c',
    `brayness-recover "http://$(ip route | awk '/default/{print $3; exit}'):${sync_port}"`
  ])
  if (!recovered.includes('pulled'))
    throw new Error(`source recovery failed: ${recovered}`)
  const saved_id = await run(next, [
    '/bin/cat',
    '/brayness/work/site/.brayness-site-id'
  ])
  if (!site.includes(saved_id.trim()))
    throw new Error('recovered site ID does not match the URL')
  await run(next, [
    '/bin/sh',
    '-c',
    'printf third > /brayness/work/site/index.html'
  ])
  const revised = await run(next, [
    '/usr/local/bin/brayness-publish',
    '/brayness/work/site'
  ])
  if (
    revised.trim().split('\n').at(-1) !== site ||
    (await content(site)) !== 'third'
  )
    throw new Error('new actor did not revise the stable URL')
  const removed = await run(next, ['/usr/local/bin/brayness-site', 'remove'])
  if (!removed.includes('unpublished') || (await fetch(site)).status !== 404)
    throw new Error('removed site is still served')
  console.log(
    `site-check: ${saved_id.trim()} revised, restored, retired, rebuilt, removed`
  )
} finally {
  if (actor) await request(`/v1/actors/${actor}`, { method: 'DELETE' })
  if (next) await request(`/v1/actors/${next}`, { method: 'DELETE' })
}
