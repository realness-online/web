/**
 * The app store's bookkeeping: records, listing, the per-app queue, and the
 * two ways `start` finishes without a VM.
 *
 * `requireRoot` is stubbed because these are the parts that do not touch a
 * TAP or Firecracker. A site needs neither, and a handler without its runtime
 * disk is refused before either is reached.
 */
import { it } from 'node:test'
import assert from 'node:assert/strict'
import {
  existsSync as exists_sync,
  mkdirSync,
  mkdtempSync,
  readdirSync as readdir_sync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { out_path } from '#root/lib/output.js'
import { AppStore } from '../../src/halo/apps.js'
import { NotFound } from '../../src/halo/errors.js'

const HANDLER = 'export default { fetch() {} }\n'

const make_store = (t, over = {}) => {
  t.mock.method(process, 'geteuid', () => 0)
  mkdirSync(out_path(), { recursive: true })
  const volume = mkdtempSync(out_path('apps-store-'))
  t.after(() => rmSync(volume, { recursive: true, force: true }))
  const store = new AppStore({
    volume,
    runtimes: join(volume, 'runtimes'),
    mib: 128,
    ...over
  })
  return { store, volume }
}

const folder = (root, name, files) => {
  const where = join(root, name)
  mkdirSync(where, { recursive: true })
  for (const [file, body] of Object.entries(files))
    writeFileSync(join(where, file), body)
  return where
}

const RECORD = {
  id: 'app-0123456789ab',
  kind: 'handler',
  owner: '+15551234567',
  address: '172.17.5.2',
  port: 8080,
  tap: 'fc-app5',
  pid: 0,
  vcpus: 1,
  mib: 128,
  created: '2026-10-01T00:00:00.000Z'
}

it('path accepts a minted id and refuses anything else', t => {
  const { store } = make_store(t)
  assert.equal(store.path(RECORD.id), join(store.dir, RECORD.id))
  assert.equal(
    store.path(RECORD.id, 'app.json'),
    join(store.dir, RECORD.id, 'app.json')
  )
  assert.throws(() => store.path('app-NOPE'), NotFound)
  assert.throws(() => store.path('../../etc'), NotFound)
  assert.throws(() => store.path(undefined), NotFound)
})

it('a written record reads back, and an absent one is NotFound', t => {
  const { store } = make_store(t)
  mkdirSync(store.path(RECORD.id), { recursive: true })
  assert.equal(store.write(RECORD), RECORD)
  assert.deepEqual(store.record(RECORD.id), RECORD)
  assert.throws(() => store.record('app-ffffffffffff'), NotFound)
})

it('list returns every app folder that has a record, oldest id first', t => {
  const { store } = make_store(t)
  const older = { ...RECORD, id: 'app-0123456789ab' }
  const newer = { ...RECORD, id: 'app-ffffffffffff' }
  mkdirSync(store.path(older.id), { recursive: true })
  mkdirSync(store.path(newer.id), { recursive: true })
  store.write(older)
  store.write(newer)

  mkdirSync(join(store.dir, 'notes'), { recursive: true })
  mkdirSync(store.path('app-bbbbbbbbbbbb'), { recursive: true })

  assert.deepEqual(
    store.list().map(record => record.id),
    [older.id, newer.id]
  )
})

it('list over a volume with no apps folder is empty', t => {
  const { store } = make_store(t)
  assert.deepEqual(store.list(), [])
})

it('setPublic flips only the flag and keeps the rest of the record', t => {
  const { store } = make_store(t)
  mkdirSync(store.path(RECORD.id), { recursive: true })
  store.write(RECORD)

  return store.setPublic(RECORD.id, true).then(() => {
    const opened = store.record(RECORD.id)
    assert.equal(opened.public, true)
    assert.deepEqual(
      { ...opened, public: undefined },
      { ...RECORD, public: undefined }
    )

    return store.setPublic(RECORD.id, false).then(() => {
      assert.equal(store.record(RECORD.id).public, false)
    })
  })
})

it('serial runs one app at a time, in the order it was asked', async t => {
  const { store } = make_store(t)
  const order = []
  const first = store.serial(RECORD.id, async () => {
    await new Promise(done => setTimeout(done, 20))
    order.push('first')
    return 'one'
  })
  const second = store.serial(RECORD.id, () => {
    order.push('second')
    return 'two'
  })
  assert.deepEqual(await Promise.all([first, second]), ['one', 'two'])
  assert.deepEqual(order, ['first', 'second'])
})

it('a failed operation does not wedge the queue', async t => {
  const { store } = make_store(t)
  const failed = store.serial(RECORD.id, () => {
    throw new Error('boom')
  })
  await assert.rejects(failed, /boom/)
  assert.equal(await store.serial(RECORD.id, () => 'next'), 'next')
})

it('a site is a record with no VM, no disk, and no TAP', async t => {
  const { store } = make_store(t)
  const files = join(store.volume, 'site-input')
  mkdirSync(files, { recursive: true })
  writeFileSync(join(files, 'index.html'), '<h1>hi</h1>')

  const started = await store.start(files, { owner: '+15551234567' })
  assert.match(started.id, /^app-[0-9a-f]{12}$/)
  assert.equal(started.kind, 'site')
  assert.equal(started.owner, '+15551234567')
  assert.equal(started.tap, undefined)
  assert.equal(exists_sync(store.path(started.id)), false)
})

it('a handler without its runtime disk is refused by name', async t => {
  const { store } = make_store(t)
  const files = folder(store.volume, 'handler-input', { 'server.js': HANDLER })
  await assert.rejects(
    store.start(files),
    /no runtime disk .*node\.ext4: run runtime-build\.sh/
  )
})

it('startFrom stages the copy, starts it, and clears the stage folder', async t => {
  const { store } = make_store(t)
  const staged = []
  const started = await store.startFrom(
    async dest => {
      staged.push(dest)
      mkdirSync(dest, { recursive: true })
      writeFileSync(join(dest, 'index.html'), '<h1>staged</h1>')
    },
    { owner: '+15551234567' }
  )
  assert.equal(staged.length, 1)
  assert.match(staged[0], /[\\/]\.stage-[0-9a-f]{12}$/)
  assert.equal(started.kind, 'site')
  assert.equal(exists_sync(staged[0]), false)
  assert.equal(
    readdir_sync(store.dir).filter(name => name.startsWith('.stage-')).length,
    0
  )
})

it('check answers null for an app that is not there at all', async t => {
  const { store } = make_store(t)
  assert.equal(await store.check('app-ffffffffffff'), null)
})

it('sweep passes over sites and anything that never booted', async t => {
  const { store } = make_store(t)
  const site = { ...RECORD, id: 'app-0123456789ab', kind: 'site' }
  const unstarted = { ...RECORD, id: 'app-ffffffffffff', booted: undefined }
  mkdirSync(store.path(site.id), { recursive: true })
  mkdirSync(store.path(unstarted.id), { recursive: true })
  store.write(site)
  store.write(unstarted)
  assert.deepEqual(await store.sweep(), [])
})

it('stop refuses an app it has no record for', async t => {
  const { store } = make_store(t)
  await assert.rejects(store.stop('app-ffffffffffff'), NotFound)
})

it('startFrom clears the stage folder even when the start refuses', async t => {
  const { store } = make_store(t)
  const staged = []
  await assert.rejects(
    store.startFrom(async dest => {
      staged.push(dest)
      mkdirSync(dest, { recursive: true })
      writeFileSync(join(dest, 'server.js'), HANDLER)
    }),
    /no runtime disk/
  )
  assert.equal(exists_sync(staged[0]), false)
})
