#!/usr/bin/env node
// Headless Chromium check of the real chat form on the dev host.
import { spawnSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const api = process.env.API ?? 'http://127.0.0.1:18080'
const web = process.env.TERM_URL ?? 'http://127.0.0.1:18090'
const session = `c1-chat-${process.pid}`
const secret = process.env.HOST_PASS_SECRET ?? readFileSync(new URL('../../dist/host-pass-secret', import.meta.url), 'utf8').trim()
const body = Buffer.from(JSON.stringify({ aud: 'brayness-host', phone: '+14156667777', exp: Math.floor(Date.now() / 1000) + 240 })).toString('base64url')
const pass = `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`

function browser(...args) {
  const result = spawnSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 150000, env: { ...process.env, AGENT_BROWSER_DEFAULT_TIMEOUT: '120000' } })
  if (result.status !== 0) throw new Error(`agent-browser ${args[0]}: ${result.stderr || result.stdout}`)
  return result.stdout.trim()
}
async function request(path, options = {}) {
  const response = await fetch(api + path, { ...options, headers: { ...options.headers, authorization: `Bearer ${pass}` } })
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`)
  return response.status === 204 ? null : response.json()
}

let actor
try {
  actor = (await request('/v1/actors', { method: 'POST' })).id
  const login = await fetch(`${web}/auth`, { method: 'POST', headers: { origin: web }, body: JSON.stringify({ pass }) })
  if (login.status !== 204) throw new Error(`auth: ${login.status}`)
  const cookie = login.headers.get('set-cookie').split(';')[0].split('=')[1]
  browser('cookies', 'set', 'brayness_terminal', cookie, '--url', web, '--httpOnly', '--sameSite', 'Strict')
  browser('open', `${web}/chat?actor=${actor}`)
  browser('snapshot', '-i')
  browser('fill', '#message', 'Reply with exactly: cedar')
  browser('press', 'Enter')
  browser('wait', '--fn', "document.querySelectorAll('#conversation li p')[1]?.textContent.includes('cedar') && !document.querySelector('#conversation [aria-busy]')")
  const content = browser('get', 'text', '#conversation li:nth-child(2) p')
  if (!content.includes('cedar')) throw new Error(`assistant reply did not render: ${content}`)
  browser('screenshot', fileURLToPath(new URL('../../../../artifacts/brayness/c1-chat-desktop.png', import.meta.url)))
  browser('set', 'viewport', '390', '844')
  browser('screenshot', fileURLToPath(new URL('../../../../artifacts/brayness/c1-chat-phone.png', import.meta.url)))
  console.log(`chat-browser-check: ${actor} sent and read a real reply in headless Chromium`)
} finally {
  try { browser('close') } catch { /* The browser may not have opened. */ }
  if (actor) await request(`/v1/actors/${actor}`, { method: 'DELETE' })
}
