import { hostname } from 'node:os'
import assert from 'node:assert/strict'
import { mkdirSync as mkdir_sync, mkdtempSync, rmSync } from 'node:fs'
import { connect } from 'node:net'
import { it } from 'node:test'
import { out_path } from '#root/lib/output.js'
import { join } from 'node:path'
import { Door } from '../../src/halo/door.js'
import {
  verify_harness_pass,
  verify_recovery_pass
} from '#root/src/sign-on/node/recovery-pass.js'
import { verify_model_pass } from '#root/src/proxy/model-pass.js'

mkdir_sync(out_path(), { recursive: true })
const root = mkdtempSync(out_path('door-owner-'))
process.env.HALO_PASS_SECRET =
  'door-owner-test-secret-at-least-thirty-two-bytes'
process.env.MODEL_PASS_SECRET =
  'door-model-test-secret-at-least-thirty-two-bytes'

it('VM-bound door ignores a claimed owner and denies actors without one', async () => {
  const record = {
    id: 'a-abcdef123456',
    owner: '+14155550123',
    vsock_path: join(root, 'vsock.sock')
  }
  const published = []
  const store = {
    live_actors: () => [record],
    get: () => record,
    publish: async (id, path) => {
      published.push([id, path])
    },
    site_versions: () => [
      { id: '012345abcdef', saved: '2026-09-29T00:00:00Z' }
    ],
    restore_site: async (id, version) => {
      published.push([id, version])
      return { url: `/s/${id}/` }
    },
    unpublish_site: async id => {
      published.push([id, 'remove'])
      return { version: '012345abcdef' }
    }
  }
  const door = new Door(store)
  door.reconcile()
  const { path, server } = door.listeners.get(record.id)
  await new Promise(done =>
    server.listening ? done() : server.once('listening', done)
  )
  const send = value =>
    new Promise((done, fail) => {
      const socket = connect(path)
      socket.once('error', fail)
      socket.once('connect', () => socket.write(`${JSON.stringify(value)}\n`))
      let answer = ''
      socket.on('data', data => {
        answer += data.toString()
      })
      socket.once('end', () => done(JSON.parse(answer)))
    })
  try {
    assert.equal(
      (
        await send({
          op: 'publish',
          owner: '+14155559999',
          path: '/realness/site'
        })
      ).ok,
      true
    )
    assert.deepEqual(published, [[record.id, '/realness/site']])
    assert.equal(
      (await send({ op: 'site-versions' })).versions[0].id,
      '012345abcdef'
    )
    assert.equal(
      (await send({ op: 'site-restore', version: '012345abcdef' })).url,
      `/s/${record.id}/`
    )
    assert.equal((await send({ op: 'site-remove' })).version, '012345abcdef')
    assert.equal(published.length, 3)
    const recovery = await send({ op: 'recovery-pass', owner: '+14155559999' })
    assert.equal(recovery.ok, true)
    assert.deepEqual(
      verify_recovery_pass(recovery.pass, process.env.HALO_PASS_SECRET),
      {
        phone: record.owner,
        id: record.id,
        paths: null,
        halo: hostname().split('.')[0].toLowerCase()
      }
    )
    const harness = await send({
      op: 'harness-pass',
      owner: '+14155559999',
      paths: ['apps']
    })
    assert.equal(harness.ok, true)
    assert.deepEqual(
      verify_harness_pass(harness.pass, process.env.HALO_PASS_SECRET),
      {
        phone: record.owner,
        id: record.id,
        paths: null,
        halo: hostname().split('.')[0].toLowerCase()
      }
    )
    record.paths = ['apps/blog']
    const limited = await send({ op: 'harness-pass', paths: null })
    assert.deepEqual(
      verify_harness_pass(limited.pass, process.env.HALO_PASS_SECRET).paths,
      record.paths
    )
    delete record.paths
    const model = await send({ op: 'model-pass', owner: '+14155559999' })
    assert.equal(model.ok, true)
    assert.deepEqual(
      verify_model_pass(model.pass, process.env.MODEL_PASS_SECRET),
      { phone: record.owner, id: record.id }
    )
    const loops = []
    door.loops = {
      start: async (id, goal) => (
        loops.push([id, goal]),
        { id: 'a-0000000000ff', depth: 1 }
      ),
      report: (parent, id) => (
        loops.push([parent, id]),
        { id, status: 'running' }
      )
    }
    assert.deepEqual(
      await send({ op: 'loop', goal: 'faster tests', owner: '+14155559999' }),
      { ok: true, id: 'a-0000000000ff', depth: 1 }
    )
    assert.deepEqual(await send({ op: 'loop-report', id: 'a-0000000000ff' }), {
      ok: true,
      loop: { id: 'a-0000000000ff', status: 'running' }
    })
    assert.deepEqual(loops, [
      [record.id, 'faster tests'],
      [record.id, 'a-0000000000ff']
    ])
    record.owner = null
    assert.equal((await send({ op: 'loop', goal: 'x' })).ok, false)
    assert.equal(
      (await send({ op: 'loop-report', id: 'a-0000000000ff' })).ok,
      false
    )
    assert.equal(loops.length, 2)
    assert.equal((await send({ op: 'model-pass' })).ok, false)
    assert.equal((await send({ op: 'recovery-pass' })).ok, false)
    assert.equal((await send({ op: 'harness-pass' })).ok, false)
    assert.equal(
      (await send({ op: 'publish', owner: '+14155550123' })).ok,
      false
    )
    assert.equal((await send({ op: 'site-versions' })).ok, false)
    assert.equal(
      (await send({ op: 'site-restore', version: '012345abcdef' })).ok,
      false
    )
    assert.equal((await send({ op: 'site-remove' })).ok, false)
    assert.equal(published.length, 3)
  } finally {
    await new Promise(done => server.close(done))
    rmSync(root, { recursive: true, force: true })
  }
})
