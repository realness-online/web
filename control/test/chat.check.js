#!/usr/bin/env node
// Live c1 bridge check: a signed owner streams a Pi reply from one actor.
import { createHmac as create_hmac } from 'node:crypto'
import { readFileSync as read_file_sync } from 'node:fs'

const api = process.env.API ?? 'http://127.0.0.1:18080'
const web = process.env.TERM_URL ?? 'http://127.0.0.1:18090'
const site_root = process.env.SITE_URL ?? 'http://127.0.0.1:18096/sites'
const phone = '+14156667777'
const secret = process.env.HOST_PASS_SECRET ?? read_file_sync(new URL('../../dist/host-pass-secret', import.meta.url), 'utf8').trim()
const body = Buffer.from(JSON.stringify({ aud: 'brayness-host', phone, exp: Math.floor(Date.now() / 1000) + 240 })).toString('base64url')
const pass = `${body}.${create_hmac('sha256', secret).update(body).digest('base64url')}`

const actor_request = async (path, options = {}) => {
  const response = await fetch(`${api}${path}`, { ...options, headers: { ...options.headers, authorization: `Bearer ${pass}` } })
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`)
  return response.status === 204 ? null : response.json()
}

let actor
try {
  actor = (await actor_request('/v1/actors', { method: 'POST' })).id
  const site = `${site_root}/${actor}/`
  const login = await fetch(`${web}/auth`, {
    method: 'POST', headers: { origin: web, 'content-type': 'application/json' }, body: JSON.stringify({ pass }),
  })
  if (login.status !== 204) throw new Error(`browser auth: ${login.status}`)
  const cookie = login.headers.get('set-cookie').split(';')[0]
  const page = await fetch(`${web}/chat?actor=${actor}`, { headers: { cookie } })
  if (!page.ok || !(await page.text()).includes('Brayness')) throw new Error(`chat page: ${page.status}`)
  const say = async message => {
    const reply = await fetch(`${web}/chat/message?actor=${actor}`, {
      method: 'POST', headers: { cookie, origin: web, 'content-type': 'application/json' },
      body: JSON.stringify({ message }), signal: AbortSignal.timeout(180000),
    })
    if (!reply.ok) throw new Error(`chat prompt: ${reply.status} ${await reply.text()}`)
    const events = (await reply.text()).trim().split('\n').filter(Boolean).map(JSON.parse)
    const text = events.filter(event => event.type === 'delta').map(event => event.text).join('')
    if (!events.some(event => event.type === 'done') || events.some(event => event.type === 'error')) throw new Error(`no completed reply: ${JSON.stringify(events).slice(-600)}`)
    return text
  }
  const created = await say('Create a simple static site in /brayness/work/site with index.html that says Copper light. Publish it with brayness publish /brayness/work/site. Reply with the site URL.')
  if (!created.includes(site) || !(await (await fetch(site)).text()).includes('Copper light')) throw new Error(`site was not created: ${created}`)
  const revised = await say('Change that same published site to say Copper tide instead, then publish it again at the same URL. Reply with the URL.')
  if (!revised.includes(site) || !(await (await fetch(site)).text()).includes('Copper tide')) throw new Error(`site was not revised: ${revised}`)
  const restored = await say('List the published site versions with brayness-site versions. Restore the version that says Copper light. Confirm the URL after checking the live site.')
  if (!restored.includes(site) || !(await (await fetch(site)).text()).includes('Copper light')) throw new Error(`site was not restored: ${restored}`)
  const removed = await say('Take this site offline with brayness-site remove. Tell me when it is offline.')
  if (!removed.toLowerCase().includes('offline') || (await fetch(site)).status !== 404) throw new Error(`site was not removed: ${removed}`)
  console.log(`chat-check: ${actor} created, revised, restored, removed its site through Pi`)
} finally {
  if (actor) await actor_request(`/v1/actors/${actor}`, { method: 'DELETE' })
}
