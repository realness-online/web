import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile as write_file } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { it } from 'node:test'
import {
  local_owner,
  local_sync_url,
  local_token_source,
  local_up,
  sync_target
} from '#root/src/files/target.js'
import { disk } from '#root/src/can/disk.js'
import { sign_in_issuer } from '#root/src/sign-in/issuer.js'

const scratch = resolve(
  import.meta.dirname,
  '../../../../artifacts/realness/target-tests'
)

/** A fetch that answers by path; anything else is refused. */
const answering =
  routes =>
  async (url, init = {}) => {
    const route = routes[new URL(url).pathname]
    if (!route) throw new TypeError('connection refused')
    return route(init)
  }
const reply = (status, body) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status
  })

it('the local stack is up only when its sync answers ok', async () => {
  assert.equal(
    await local_up(answering({ '/health': () => reply(200, 'ok\n') })),
    true
  )
  assert.equal(await local_up(answering({})), false)
  assert.equal(
    await local_up(answering({ '/health': () => reply(200, 'nginx') })),
    false
  )
})

it('sync goes to the local stack when it is up, else to the person sync', async () => {
  const up = await sync_target({
    fetcher: answering({ '/health': () => reply(200, 'ok') })
  })
  assert.equal(up.local, true)
  assert.equal(up.url, local_sync_url)
  const down = await sync_target({ fetcher: answering({}) })
  assert.equal(down.local, false)
  assert.notEqual(down.url, local_sync_url)
})

/** A folder for the owner page and issuer key, removed after the test. */
const scratch_dir = async t => {
  await mkdir(scratch, { recursive: true })
  const dir = await mkdtemp(join(scratch, 'owner-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

it('the local owner comes from person.local.html', async t => {
  const dir = await scratch_dir(t)
  await mkdir(join(dir, '.pi'), { recursive: true })
  await write_file(
    join(dir, '.pi/person.local.html'),
    '<a itemprop="telephone" href="tel:+15555550100">Owner</a>'
  )
  assert.equal(local_owner(dir), '+15555550100')
})

it('without person.local.html there is no local owner', async t => {
  assert.throws(() => local_owner(join(scratch, 'missing')), /no local owner/)
})

it('local tokens are minted for the owner with the sign-in key, no code', async t => {
  const dir = await scratch_dir(t)
  const storage = disk(dir)
  const token = await local_token_source({
    phone: '+15555550100',
    storage,
    project: 'demo-test'
  })()
  const [, body] = token.split('.')
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  assert.equal(claims.phone_number, '+15555550100')
  assert.equal(claims.aud, 'demo-test')
  const issuer = await sign_in_issuer(storage, { project: 'demo-test' })
  assert.deepEqual(Object.keys(await issuer.certs()).length, 1)
})
