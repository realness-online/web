#!/usr/bin/env node

import { dirname, join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { parseArgs as parse_args } from 'node:util'
import { Door } from '../../src/host/door.js'
import { ChromePool, render_page } from '../../src/host/chrome-pool.js'
import { WebEngine } from '../../src/host/web-engine.js'
import { ChromeLeases } from '../../src/host/chrome-leases.js'
import { Loops } from '../../src/host/loops.js'
import { HostStatus } from '../../src/host/status.js'
import { ActorRequests } from '../../src/host/requests.js'
import { SyncSites } from '../../src/host/sync-sites.js'
import { hostname } from 'node:os'
import { existsSync as exists_sync, readFileSync as read_file_sync } from 'node:fs'
import { SyncMirror } from '../../src/host/sync-mirror.js'
import { logger } from '../../src/host/log.js'
import * as pty from '../../src/host/pty.js'
import * as server from '../../src/host/server.js'
import { ActorStore } from '../../src/host/actors.js'
import { AppStore } from '../../src/host/apps.js'
import { issue_model_pass } from '#root/src/proxy/model-pass.js'

const LOG = logger('host')
const HERE = dirname(file_url_to_path(import.meta.url))
const FLUSH_MS = 5000
const SWEEP_MS = 60_000
const APP_SWEEP_MS = 5000
const STATUS_MS = 30_000

const { positionals, values } = parse_args({
  allowPositionals: true,
  options: {
    volume: { type: 'string', default: '/opt/fc/actors/mnt' },
    template: { type: 'string', default: '/opt/fc/template.ext4' },
    'app-image': { type: 'string', default: '/opt/fc/app.ext4' },
    kernel: { type: 'string', default: '/opt/fc/vmlinux-6.1.155' },
    firecracker: { type: 'string', default: '/opt/fc/firecracker' },
    'guest-mac': { type: 'string', default: '06:00:AC:10:00:02' },
    'guest-cid': { type: 'string', default: '3' },
    'vsock-port': { type: 'string', default: '52' },
    vcpu: { type: 'string', default: '2' },
    'mem-mib': { type: 'string', default: '512' },
    'tap-prefix': { type: 'string', default: 'fc-tap' },
    'seed-tap': { type: 'string', default: 'fc-tap0' },
    'boot-timeout': { type: 'string', default: '60' },
    'api-timeout': { type: 'string', default: '30' },
    listen: { type: 'string', default: '0.0.0.0' },
    port: { type: 'string', default: '8080' },
    'pty-port': { type: 'string', default: '8081' },
    'pty-listen': { type: 'string' },
    'api-listen': { type: 'string' },
    rebuild: { type: 'boolean', default: false }
  }
})

const command = positionals[0]
if (command !== 'serve' && command !== 'seed') {
  console.error('usage: main.js serve|seed [--volume PATH] ...')
  process.exit(2)
}

const store = new ActorStore({
  volume: values.volume,
  template: values.template,
  kernel: values.kernel,
  firecracker: values.firecracker,
  guestMac: values['guest-mac'],
  guestCid: Number(values['guest-cid']),
  vsockPort: Number(values['vsock-port']),
  vcpus: Number(values.vcpu),
  mib: Number(values['mem-mib']),
  tapPrefix: values['tap-prefix'],
  seedTap: values['seed-tap'],
  bootTimeout: Number(values['boot-timeout']),
  apiTimeout: Number(values['api-timeout']),
  syncUrl: process.env.SYNC_URL ?? null
})
const warning = store.reflinkWarning()
if (warning) LOG.warn(warning)

if (command === 'seed') {
  const status = await store.ensureSeed({ rebuild: values.rebuild })
  LOG.info(`seed ready: ${JSON.stringify(status.record)}`)
  process.exit(0)
}

await store.ensureSeed()
if (process.env.SYNC_SITE_URL)
  store.syncSites = new SyncSites({
    url: process.env.SYNC_SITE_URL,
    secret: process.env.HOST_PASS_SECRET
  })
const listen = (what, port, address = values.listen) =>
  new Promise(done => what.listen(Number(port), address, done))

const addresses = list =>
  (list ?? values.listen)
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
for (const address of addresses(values['pty-listen'])) {
  await listen(pty.makeServer(store), values['pty-port'], address)
  LOG.info(`pty stream on ${address}:${values['pty-port']}`)
}
const proxy_url = (
  process.env.BRAYNESS_PROXY_URL ??
  'https://brayness-proxy-yelzvhhngq-uc.a.run.app'
).replace(/\/$/, '')
const limits = process.env.MODEL_PASS_SECRET
  ? async record => {
      const pass = issue_model_pass(
        { phone: record.owner, id: record.id },
        process.env.MODEL_PASS_SECRET
      )
      const reply = await fetch(`${proxy_url}/limit`, {
        headers: { authorization: `Bearer ${pass}` },
        signal: AbortSignal.timeout(5000)
      })
      if (!reply.ok) throw new Error(`proxy /limit ${reply.status}`)
      return reply.json()
    }
  : null
const host = hostname().split('.')[0]
const record_secret_file = process.env.RECORD_SECRET_FILE
if (process.env.SYNC_URL && !record_secret_file)
  throw new Error('SYNC_URL needs RECORD_SECRET_FILE')
const mirror = process.env.SYNC_URL
  ? new SyncMirror({
      url: process.env.SYNC_URL,
      secret: read_file_sync(String(record_secret_file), 'utf8').trim(),
      host
    })
  : null
const loops = new Loops(store, { mirror, host })
const site_public = process.env.SYNC_SITE_PUBLIC_URL ?? process.env.SYNC_SITE_URL
if (store.syncSites && !site_public)
  throw new Error('sync sites need SYNC_SITE_PUBLIC_URL or SYNC_SITE_URL')
const site_url = store.syncSites
  ? `${String(site_public).replace(/\/$/, '')}/sites/{id}/`
  : '/s/{id}/'
const chrome_image = process.env.BRAYNESS_CHROME_IMAGE ?? '/opt/fc/chrome.ext4'
const chrome_pool =
  process.env.BRAYNESS_CHROME_POOL !== 'off' && exists_sync(chrome_image)
    ? new ChromePool({ root: join(values.volume, 'chrome-pool'), image: chrome_image, kernel: values.kernel, binary: values.firecracker })
    : null
const chrome = chrome_pool ? new ChromeLeases(chrome_pool) : null
const render = chrome_pool
  ? async (url) => {
      const copy = await chrome_pool.restore()
      try {
        return await render_page(copy.address, url)
      } finally {
        await chrome_pool.destroy(copy.n)
      }
    }
  : null
const web_firecrawl_file = process.env.FIRECRAWL_API_KEY_FILE
const web = new WebEngine({
  root: join(values.volume, 'web-cache'),
  render,
  firecrawl_key: process.env.FIRECRAWL_API_KEY ?? (web_firecrawl_file && exists_sync(web_firecrawl_file) ? read_file_sync(web_firecrawl_file, 'utf8').trim() : null)
})
setInterval(() => web.prune(), 6 * 3_600_000).unref()
new Door(store, process.env.BRAYNESS_SITE_URL ?? site_url, loops, chrome, web).start()
const apps = new AppStore({
  volume: values.volume,
  image: values['app-image'],
  kernel: values.kernel,
  firecracker: values.firecracker
})
for (const address of addresses(values['api-listen'])) {
  await listen(
    server.makeServer(store, apps, undefined, loops, { limits }),
    values.port,
    address
  )
  LOG.info(`listening on ${address}:${values.port}`)
}

const sweep = async () => {
  try {
    const done = await store.sweep()
    for (const { id, step } of done) LOG.info(`lifecycle: ${id} -> ${step}`)
  } catch (error) {
    LOG.warn(`idle sweep failed: ${error.message}`)
  }
  setTimeout(sweep, SWEEP_MS)
}

const flush = async () => {
  try {
    await store.flushAll()
  } catch (error) {
    LOG.warn(`flush failed: ${error.message}`)
  }
  setTimeout(flush, FLUSH_MS)
}
setTimeout(flush, FLUSH_MS)
setTimeout(sweep, SWEEP_MS)

const superviseApps = async () => {
  try {
    for (const { id, step } of await apps.sweep())
      LOG.info(`app: ${id} -> ${step}`)
  } catch (error) {
    LOG.warn(`app sweep failed: ${error.message}`)
  }
  setTimeout(superviseApps, APP_SWEEP_MS)
}
superviseApps()

const status = new HostStatus(store, {
  mirror,
  apps,
  loops,
  host,
  warn: message => LOG.warn(message)
})
const requests = new ActorRequests(store, {
  mirror,
  host,
  warn: message => LOG.warn(message)
})
const report = async () => {
  for (const { id, action } of await requests.obey())
    LOG.info(`admin request: ${action} ${id}`)
  await status.publish()
  setTimeout(report, STATUS_MS)
}
if (mirror) report()
