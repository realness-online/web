import assert from 'node:assert/strict'
import { randomBytes as random_bytes } from 'node:crypto'
import {
  cpSync as cp_sync,
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { request } from 'node:http'
import { join } from 'node:path'
import { AppStore } from '../../../src/halo/apps.js'
import { Actor } from '../../../src/halo/actors.js'
import { NotFound } from '../../../src/halo/errors.js'
import { issue_halo_pass } from '#root/src/sign-on/node/halo-pass.js'
import { makeServer as make_server } from '../../../src/halo/server.js'

const secret = (process.env.HALO_PASS_SECRET ||=
  random_bytes(32).toString('hex'))
const alice = '+14155550123'
const bob = '+14155559999'
const pass = phone => `Bearer ${issue_halo_pass({ phone }, secret)}`

const fixtures = mkdtemp_sync('/opt/fc/actors/mnt/.app-api-check-')
mkdir_sync(join(fixtures, 'demo'))
write_file_sync(
  join(fixtures, 'demo/server.js'),
  'export default { fetch: () => new Response("api demo\\n") }\n'
)
write_file_sync(join(fixtures, 'demo/package.json'), '{"name": "demo"}\n')
mkdir_sync(join(fixtures, 'page'))
write_file_sync(join(fixtures, 'page/index.html'), '<p>site</p>\n')

/**
 * The routes reach a store for these eighteen methods; this check exercises
 * `get` and `copyOut` only. A named throw keeps an accidental reach loud
 * instead of answering wrongly.
 */
const unreached = name => () => {
  throw new Error(`app-api-check does not stand in store.${name}`)
}

const actor = new Actor({ id: 'a-check', owner: alice })
/** @type {import('../../../src/halo/server.js').RouteStore} */
const actors = {
  get: id => {
    if (id !== actor.id) throw new NotFound(id)
    return actor
  },
  copyOut: async (id, tree, dest) =>
    cp_sync(join(fixtures, tree.slice('/realness/work/'.length)), dest, {
      recursive: true
    }),
  create: unreached('create'),
  destroy: unreached('destroy'),
  exec: unreached('exec'),
  export: unreached('export'),
  idle: unreached('idle'),
  list: unreached('list'),
  publish: unreached('publish'),
  publishedSite: unreached('publishedSite'),
  reload: unreached('reload'),
  restore: unreached('restore'),
  seedStatus: unreached('seedStatus'),
  traceOf: unreached('traceOf'),
  ensureRunning: unreached('ensureRunning'),
  beginWork: unreached('beginWork'),
  endWork: unreached('endWork'),
  firstTurn: unreached('firstTurn')
}
const apps = new AppStore({
  volume: fixtures,
  kernel: '/opt/fc/vmlinux-6.1.155',
  firecracker: '/opt/fc/firecracker'
})
const server = make_server(actors, apps)
/** @type {Promise<void>} */
const listening = new Promise(resolve => {
  server.listen(8180, '127.0.0.1', () => resolve())
})
await listening
const call = async (method, path, who, body) => {
  const response = await fetch(`http://127.0.0.1:8180${path}`, {
    method,
    headers: { authorization: pass(who), 'content-type': 'application/json' },
    ...(body && { body: JSON.stringify(body) })
  })
  return {
    status: response.status,
    body: response.status === 204 ? null : await response.json()
  }
}

let id
try {
  const started = await call('POST', '/v1/apps', alice, {
    actor: 'a-check',
    path: '/realness/work/demo'
  })
  assert.equal(started.status, 201, JSON.stringify(started.body))
  id = started.body.id
  assert.equal(started.body.kind, 'handler')
  console.log(
    `  ok   POST starts ${id} at ${started.body.address}:${started.body.port}`
  )

  const reply = await (
    await fetch(`http://${started.body.address}:${started.body.port}/`)
  ).text()
  assert.equal(reply, 'api demo\n')
  console.log('  ok   the app answers from its own VM')

  const via = (path, cookie) =>
    new Promise((done, fail) =>
      request(
        {
          host: '127.0.0.1',
          port: 8180,
          path,
          headers: { host: `${id}.localhost`, ...(cookie && { cookie }) }
        },
        res => {
          let body = ''
          res
            .on('data', chunk => (body += chunk))
            .on('end', () =>
              done({ status: res.statusCode, body, headers: res.headers })
            )
        }
      )
        .on('error', fail)
        .end()
    )
  assert.equal((await via('/')).status, 404)
  console.log("  ok   a private app is 404 without its owner's cookie")
  const enter = await call('POST', `/v1/apps/${id}/enter`, alice)
  assert.equal((await call('POST', `/v1/apps/${id}/enter`, bob)).status, 404)
  const link = new URL(enter.body.url)
  const entered = await via(link.pathname + link.search)
  assert.equal(entered.status, 302)
  const cookie = entered.headers['set-cookie'][0].split(';')[0]
  const routed = await via('/', cookie)
  assert.equal(routed.status, 200)
  assert.equal(routed.body, 'api demo\n')
  console.log(`  ok   the owner's link opens ${id}.localhost through the halo`)
  assert.equal(
    (await call('POST', `/v1/apps/${id}/visibility`, alice, { public: true }))
      .body.public,
    true
  )
  assert.equal((await via('/')).status, 200)
  assert.equal(
    (await call('POST', `/v1/apps/${id}/visibility`, alice, { public: false }))
      .body.public,
    false
  )
  assert.equal((await via('/')).status, 404)
  console.log('  ok   visibility opens and closes the app')

  const status = await call('GET', `/v1/apps/${id}`, alice)
  assert.equal(status.status, 200)
  assert.equal(status.body.running, true)
  assert.equal(status.body.answering, true)
  console.log('  ok   GET says running and answering')

  const rebooted = await apps.serial(id, () => apps.boot(id))
  assert.equal(rebooted.address, started.body.address)
  assert.equal(rebooted.tap, started.body.tap)
  assert.notEqual(rebooted.pid, started.body.pid)
  assert.equal(
    await (await fetch(`http://${rebooted.address}:${rebooted.port}/`)).text(),
    'api demo\n'
  )
  console.log('  ok   a reboot keeps TAP and address, new VM answers')

  assert.deepEqual(
    (await call('GET', '/v1/apps', alice)).body.apps
      .map(app => app.id)
      .includes(id),
    true
  )
  assert.deepEqual((await call('GET', '/v1/apps', bob)).body.apps, [])
  assert.equal((await call('GET', `/v1/apps/${id}`, bob)).status, 404)
  assert.equal((await call('DELETE', `/v1/apps/${id}`, bob)).status, 404)
  console.log('  ok   another owner sees nothing and stops nothing')

  const site = await call('POST', '/v1/apps', alice, {
    actor: 'a-check',
    path: '/realness/work/page'
  })
  assert.equal(site.status, 201)
  assert.equal(site.body.kind, 'site')
  assert.equal(exists_sync(apps.path(site.body.id)), false)
  console.log('  ok   a site gets a record and no VM')

  assert.equal((await call('DELETE', `/v1/apps/${id}`, alice)).status, 204)
  assert.equal(exists_sync(apps.path(id)), false)
  assert.equal((await call('GET', `/v1/apps/${id}`, alice)).status, 404)
  id = null
  console.log('  ok   DELETE stops the VM and removes its files')
  console.log('app-api-check: all green')
} finally {
  if (id) await apps.stop(id).catch(() => {})
  rm_sync(fixtures, { recursive: true, force: true })
  server.closeAllConnections()
  server.close()
}
