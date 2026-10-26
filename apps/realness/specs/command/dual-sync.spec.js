import assert from 'node:assert/strict'
import { after, before, it } from 'node:test'
import { randomUUID as random_uuid } from 'node:crypto'
import { mkdir, rm, writeFile as write_file } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { disk } from '#root/src/can/disk.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'
import {
  run_harness,
  SYNC_LOCAL_ONLY
} from '../../src/command/harness-command.js'

const A = '+15555550100'
const base = resolve(
  import.meta.dirname,
  `../../../../artifacts/realness/dual-sync-${random_uuid()}`
)
const issuer = dev_issuer()
const git_ceiling = process.env.GIT_CEILING_DIRECTORIES
/** @type {Record<string, { server: import('node:http').Server, url: string, bucket: string }>} */
const stacks = {}

const start = async name => {
  const bucket = join(base, `${name}-bucket`)
  const storage = disk(bucket)
  const server = sync_service({
    storage,
    rights: rights(storage),
    project: issuer.project,
    certs: issuer.certs,
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const address = /** @type {import('node:net').AddressInfo} */ (
    server.address()
  )
  stacks[name] = {
    server,
    bucket,
    url: `http://127.0.0.1:${address.port}`
  }
}

before(async () => {
  process.env.GIT_CEILING_DIRECTORIES = base
  await Promise.all([start('local'), start('cloud')])
})
after(async () => {
  if (git_ceiling === undefined) delete process.env.GIT_CEILING_DIRECTORIES
  else process.env.GIT_CEILING_DIRECTORIES = git_ceiling
  for (const { server } of Object.values(stacks)) server.close()
  await rm(base, { recursive: true, force: true })
})

const harness = async () => {
  const root = join(base, `h-${random_uuid()}`)
  await mkdir(join(root, 'vault'), { recursive: true })
  await write_file(join(root, 'package.json'), '{}')
  await write_file(join(root, 'vault/note.md'), 'both places\n')
  const state = join(root, '.pi/agent/state')
  await mkdir(state, { recursive: true })
  const output = []
  const io = {
    stdout: { write: text => output.push(text) },
    stderr: { write: text => output.push(text) }
  }
  const token = async () => issuer.token(A)
  const target = async () => ({
    local: true,
    url: stacks.local.url,
    get_token: token
  })
  const also = async () => ({
    local: false,
    url: stacks.cloud.url,
    get_token: token
  })
  return { root, state, output, io, target, also }
}

const reported = output =>
  output
    .map(line => JSON.parse(line))
    .map(({ ok, target }) => ({ ok, target: target.split(' ')[0] }))

it('an explicit sync with the local stack up goes to local, then production', async () => {
  const { root, state, output, io, target, also } = await harness()
  assert.equal(
    await run_harness(['sync', '--json'], { root, state, target, also, ...io }),
    0
  )
  assert.deepEqual(reported(output), [
    { ok: true, target: 'local' },
    { ok: true, target: 'production' }
  ])
})

it('sync-local-only keeps the second pass home', async () => {
  const { root, state, output, io, target, also } = await harness()
  await write_file(join(state, SYNC_LOCAL_ONLY), '')
  assert.equal(
    await run_harness(['sync', '--json'], { root, state, target, also, ...io }),
    0
  )
  assert.equal(output.length, 1)
  assert.equal(JSON.parse(output[0]).target, undefined)
})

it('production not signed in is skipped, local still syncs', async () => {
  const { root, state, output, io, target } = await harness()
  const also = async () => ({
    local: false,
    url: stacks.cloud.url,
    get_token: async () => null
  })
  assert.equal(
    await run_harness(['sync', '--json'], { root, state, target, also, ...io }),
    0
  )
  assert.match(output.at(-1), /production skipped: not signed in/)
})
