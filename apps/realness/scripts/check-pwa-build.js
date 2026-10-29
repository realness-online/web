/**
 * pw2: the built app keeps its PWA traits.
 *
 * site-check covers rules every Realness site shares. These are the app's
 * own: what the worker precaches, the push handlers it imports, and icon
 * versions that bust the home-screen cache together.
 */
import fs from 'node:fs'
import path from 'node:path'
import { frontend_out } from '#root/src/settings/output.js'
import { check_worker, precached } from '../../../.pi/bin/checks/pwa-worker.js'
import { run_entry } from './lib/entry.js'

const LABEL = 'check-pwa-build'
const WORKER = 'service.worker.js'
const MUST_CACHE = ['index.html', 'icons.svg', 'vector.worker.js']
const NEVER_CACHE = /ghostty-vt-.*\.wasm$/
const PUSH = '/push-handlers.js'

/**
 * @param {string} dist_dir
 * @returns {{ rule: string, text: string }[]}
 */
export const check_pwa_build = dist_dir => {
  const read = name => {
    const file = path.join(dist_dir, name)
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  }
  const worker = read(WORKER)
  if (worker === null) return [{ rule: 'pwa-worker', text: `no ${WORKER}` }]
  const hits = check_worker(worker)
  const hit = (rule, text) => hits.push({ rule, text })

  const cached = precached(worker)
  const fonts = fs
    .readdirSync(path.join(dist_dir, 'fonts'))
    .filter(name => name.endsWith('.woff2'))
    .map(name => `fonts/${name}`)
  for (const name of [...MUST_CACHE, ...fonts])
    if (!cached.has(name)) hit('pwa-precache', `${name} is not precached`)
  for (const name of cached)
    if (NEVER_CACHE.test(name))
      hit('pwa-precache', `${name} is precached; it is too large`)

  if (!worker.includes(`importScripts("${PUSH}")`))
    hit('pwa-push', `worker does not import ${PUSH}`)
  const push = read(PUSH.slice(1)) ?? ''
  for (const event of ['push', 'notificationclick'])
    if (!push.includes(`addEventListener('${event}'`))
      hit('pwa-push', `${PUSH} has no ${event} handler`)

  const manifest = JSON.parse(read('manifest.webmanifest') ?? '{}')
  const versions = new Set(
    [
      ...(manifest.icons ?? []).map(icon => icon.src),
      ...[
        ...(read('index.html') ?? '').matchAll(/href="([^"]*\.png[^"]*)"/g)
      ].map(([, href]) => href)
    ].map(src => new URL(src, 'https://x.invalid/').searchParams.get('v'))
  )
  if (versions.has(null) || versions.size !== 1)
    hit(
      'pwa-icon-version',
      `icons must share one ?v=; found ${[...versions].join(', ')}`
    )
  return hits
}

/** @param {{ dist_dir?: string }} [options] */
export const main = ({ dist_dir = frontend_out() } = {}) => {
  const hits = check_pwa_build(dist_dir)
  for (const { rule, text } of hits) console.error(`${LABEL}  ${rule}  ${text}`)
  if (hits.length) throw new Error(`${LABEL}: ${hits.length} hit(s)`)
  console.info(`${LABEL}: worker, precache, push, and icon versions hold`)
}

run_entry(import.meta.url, main)
