#!/usr/bin/env node

import { halo_pass_secret } from '#root/src/sign-on/node/halo-secret.js'
import { dirname, join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { parseArgs as parse_args } from 'node:util'
import { Door } from '#root/src/halo/door.js'
import { ChromePool, render_page } from '#root/src/halo/chrome-pool.js'
import { WebEngine } from '#root/src/halo/web-engine.js'
import { ChromeLeases } from '#root/src/halo/chrome-leases.js'
import { Loops } from '#root/src/halo/loops.js'
import { HaloStatus } from '#root/src/halo/status.js'
import { ActorRequests } from '#root/src/halo/requests.js'
import { SyncSites } from '#root/src/halo/sync-sites.js'
import { hostname } from 'node:os'
import {
  existsSync as exists_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import { SyncMirror } from '#root/src/halo/sync-mirror.js'
import { logger } from '#root/src/halo/log.js'
import * as pty from '#root/src/halo/pty.js'
import * as server from '#root/src/halo/server.js'
import { ActorStore, ACTOR_MIB } from '#root/src/halo/actors.js'
import { BoxStore } from '#root/src/halo/box.js'
import { AppStore } from '#root/src/halo/apps.js'
import { Parker } from '#root/src/halo/parking.js'
import { execFile as exec_file } from 'node:child_process'
import { promisify } from 'node:util'
import { issue_model_pass } from '#root/src/proxy/model-pass.js'
import { environment_settings } from '#root/src/settings/environments.js'

const LOG = logger('halo')
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
    'mem-mib': { type: 'string', default: String(ACTOR_MIB) },
    'tap-prefix': { type: 'string', default: 'fc-tap' },
    'seed-tap': { type: 'string', default: 'fc-tap0' },
    'boot-timeout': { type: 'string', default: '60' },
    'api-timeout': { type: 'string', default: '30' },
    listen: { type: 'string', default: '0.0.0.0' },
    port: { type: 'string', default: '8080' },
    'pty-port': { type: 'string', default: '8081' },
    'pty-listen': { type: 'string' },
    'api-listen': { type: 'string' },
    'site-url': { type: 'string' },
    environment: { type: 'string' },
    runtime: { type: 'string', default: 'firecracker' },
    'host-vault': { type: 'string' },
    'host-owner': { type: 'string' },
    rebuild: { type: 'boolean', default: false },
    park: { type: 'boolean', default: false }
  }
})

const command = positionals[0]
if (command !== 'serve' && command !== 'seed') {
  console.error('usage: main.js serve|seed [--volume PATH] ...')
  process.exit(2)
}
/** Serve names its environment; there is no default to fall back to. */
const environment =
  command === 'serve' ? environment_settings(values.environment ?? '') : null
/** Where this halo's sync, published sites, and their public address live. */
const sync_url =
  environment?.services?.halo_sync_url ??
  environment?.services?.sync_url ??
  null
const site_sync_url = environment?.services?.site_sync_url ?? sync_url
const site_public = environment?.services?.sites_url || site_sync_url

const { runtime } = values
const store =
  runtime === 'box'
    ? new BoxStore({
        volume: values.volume,
        template: values.template,
        vsock_port: Number(values['vsock-port']),
        boot_timeout: Number(values['boot-timeout']),
        api_timeout: Number(values['api-timeout']),
        sync_url: environment?.services?.actor_sync_url ?? sync_url,
        host_vault:
          values['host-vault'] && values['host-owner']
            ? { path: values['host-vault'], owner: values['host-owner'] }
            : null
      })
    : new ActorStore({
        volume: values.volume,
        template: values.template,
        kernel: values.kernel,
        firecracker: values.firecracker,
        guest_mac: values['guest-mac'],
        guest_cid: Number(values['guest-cid']),
        vsock_port: Number(values['vsock-port']),
        vcpus: Number(values.vcpu),
        mib: Number(values['mem-mib']),
        tap_prefix: values['tap-prefix'],
        seed_tap: values['seed-tap'],
        boot_timeout: Number(values['boot-timeout']),
        api_timeout: Number(values['api-timeout']),
        sync_url: environment?.services?.actor_sync_url ?? sync_url
      })
const warning = store.reflink_warning()
if (warning) LOG.warn(warning)

if (command === 'seed') {
  const status = await store.ensure_seed({ rebuild: values.rebuild })
  LOG.info(`seed ready: ${JSON.stringify(status.record)}`)
  process.exit(0)
}

await store.ensure_seed()
if (site_sync_url)
  store.sync_sites = new SyncSites({
    url: site_sync_url,
    secret: halo_pass_secret()
  })
const listen = (what, port, address = values.listen) =>
  new Promise(done => what.listen(Number(port), address, done))

const addresses = list =>
  (list ?? values.listen)
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
for (const address of addresses(values['pty-listen'])) {
  await listen(pty.make_server(store), values['pty-port'], address)
  LOG.info(`pty stream on ${address}:${values['pty-port']}`)
}
const proxy_url = (
  environment.services.starter_proxy_url ?? environment.services.proxy_url
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
const halo = hostname().split('.')[0]
const record_secret_file = process.env.RECORD_SECRET_FILE
if (sync_url && !record_secret_file)
  throw new Error('a halo with sync needs RECORD_SECRET_FILE')
const mirror = sync_url
  ? new SyncMirror({
      url: sync_url,
      secret: read_file_sync(String(record_secret_file), 'utf8').trim(),
      halo
    })
  : null
const loops = new Loops(store, { mirror, halo })
const site_url = store.sync_sites
  ? `${String(site_public).replace(/\/$/, '')}/sites/{id}/`
  : '/s/{id}/'
const chrome_image = '/opt/fc/chrome.ext4'
const chrome_pool = exists_sync(chrome_image)
  ? new ChromePool({
      root: join(values.volume, 'chrome-pool'),
      image: chrome_image,
      kernel: values.kernel,
      binary: values.firecracker
    })
  : null
const chrome = chrome_pool
  ? new ChromeLeases(chrome_pool, { work: store })
  : null
const render = chrome_pool
  ? async url => {
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
  firecrawl_key:
    process.env.FIRECRAWL_API_KEY ??
    (web_firecrawl_file && exists_sync(web_firecrawl_file)
      ? read_file_sync(web_firecrawl_file, 'utf8').trim()
      : null)
})
setInterval(() => web.prune(), 6 * 3_600_000).unref()
new Door(store, values['site-url'] ?? site_url, loops, chrome, web).start()
const apps = new AppStore({
  volume: values.volume,
  image: values['app-image'],
  kernel: values.kernel,
  firecracker: values.firecracker
})
for (const address of addresses(values['api-listen'])) {
  await listen(
    server.make_server(store, apps, undefined, loops, { limits }),
    values.port,
    address
  )
  LOG.info(`listening on ${address}:${values.port}`)
}

const parker =
  values.park && mirror
    ? new Parker({
        store,
        loops,
        apps_running: async () =>
          (
            await Promise.all(apps.list().map(app => apps.status(app.id)))
          ).filter(app => app.running).length,
        held: () => exists_sync('/run/realness-hold'),
        mirror,
        halo,
        poweroff: () =>
          promisify(exec_file)('systemctl', ['--no-block', 'poweroff'])
      })
    : null

const sweep = async () => {
  if (parker) {
    const decided = await parker.check()
    if (decided.state === 'parked') return
  }
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
    await store.flush_all()
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

const status = new HaloStatus(store, {
  mirror,
  apps,
  loops,
  halo,
  warn: message => LOG.warn(message)
})
const requests = new ActorRequests(store, {
  mirror,
  halo,
  warn: message => LOG.warn(message)
})
const report = async () => {
  for (const { id, action } of await requests.obey())
    LOG.info(`admin request: ${action} ${id}`)
  await status.publish()
  setTimeout(report, STATUS_MS)
}
if (mirror) report()
