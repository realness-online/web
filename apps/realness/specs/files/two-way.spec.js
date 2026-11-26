/**
 * l4: the Mac's `vault/` and `quarantine/` sync both ways, every write guarded
 * by the version it started from. Nothing is deleted, so a change one side has
 * not seen stays.
 */
import assert from 'node:assert/strict'
import { randomUUID as random_uuid } from 'node:crypto'
import {
  mkdir,
  readFile as read_file,
  rm,
  writeFile as write_file
} from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { it } from 'node:test'
import { disk } from '#root/src/can/disk.js'
import { members_html } from '#root/src/can/members.js'
import { store_of } from '#root/src/can/store.js'
import { two_way } from '#root/src/files/two-way.js'
import { out_path } from '#root/lib/output.js'

const PHONE = '+15555550100'
const base = `people/${PHONE}/`

/**
 * A Mac with a store beside it, and the record the next run reads.
 * @param {import('node:test').TestContext} t
 */
const mac = async t => {
  const dir = out_path(`two-way-test-${random_uuid()}`)
  t.after(() => rm(dir, { recursive: true, force: true }))
  const root = join(dir, 'harness')
  const store = store_of(disk(join(dir, 'store')))
  await mkdir(join(root, 'vault'), { recursive: true })
  await mkdir(join(root, 'quarantine'), { recursive: true })
  const record = join(dir, 'state/sync-record.json')
  const sync = () => two_way({ root, store, phone: PHONE, record })
  const local = path => read_file(join(root, path), 'utf8')
  const put = async (path, text) => {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await write_file(join(root, path), text)
  }
  const remote = async path =>
    (await store.get(`${base}${path}`))?.body.toString()
  return { root, store, record, sync, local, put, remote }
}

it('a new file goes up, and a second pass is idle', async t => {
  const run = await mac(t)
  await run.put('vault/note.md', 'a note\n')
  const first = await run.sync()
  assert.deepEqual(first.pushed, ['vault/note.md'])
  assert.equal(await run.remote('vault/note.md'), 'a note\n')
  const again = await run.sync()
  assert.deepEqual(again.pushed, [])
  assert.deepEqual(again.unchanged, ['vault/note.md'])
})

it('a file the cloud moved comes down when the Mac left it alone', async t => {
  const run = await mac(t)
  await run.put('vault/note.md', 'a note\n')
  await run.sync()
  await run.store.put(`${base}vault/note.md`, Buffer.from('from the cloud\n'))
  const report = await run.sync()
  assert.deepEqual(report.pulled, ['vault/note.md'])
  assert.equal(await run.local('vault/note.md'), 'from the cloud\n')
})

it('a file the Mac moved goes up, guarded by the version it read', async t => {
  const run = await mac(t)
  await run.put('vault/note.md', 'a note\n')
  await run.sync()
  await run.put('vault/note.md', 'edited here\n')
  const report = await run.sync()
  assert.deepEqual(report.pushed, ['vault/note.md'])
  assert.equal(await run.remote('vault/note.md'), 'edited here\n')
})

it('both moving keeps both, the cloud copy beside the Mac copy', async t => {
  const run = await mac(t)
  await run.put('vault/note.md', 'a note\n')
  await run.sync()
  await run.put('vault/note.md', 'edited here\n')
  await run.store.put(`${base}vault/note.md`, Buffer.from('edited there\n'))
  const report = await run.sync()
  assert.deepEqual(report.kept_both, ['vault/note.md'])
  assert.equal(await run.local('vault/note.md'), 'edited here\n')
  assert.equal(await run.local('vault/note.conflict.md'), 'edited there\n')
  assert.equal(await run.remote('vault/note.md'), 'edited here\n')
})

it('quarantine travels both ways, at the same path', async t => {
  const run = await mac(t)
  await run.put('quarantine/actor-1/vault/Projects/plan.md', 'a change\n')
  const up = await run.sync()
  assert.deepEqual(up.pushed, ['quarantine/actor-1/vault/Projects/plan.md'])
  assert.equal(
    await run.remote('quarantine/actor-1/vault/Projects/plan.md'),
    'a change\n'
  )
  await run.store.put(
    `${base}quarantine/actor-2/vault/Waiting.md`,
    Buffer.from('held\n')
  )
  const down = await run.sync()
  assert.deepEqual(down.pulled, ['quarantine/actor-2/vault/Waiting.md'])
  assert.equal(await run.local('quarantine/actor-2/vault/Waiting.md'), 'held\n')
})

it('a file the store lost goes, when the record knows this copy', async t => {
  const run = await mac(t)
  await run.put('vault/note.md', 'a note\n')
  await run.sync()
  await run.store.delete(`${base}vault/note.md`)
  const report = await run.sync()
  assert.deepEqual(report.deleted, ['vault/note.md'])
  await assert.rejects(read_file(join(run.root, 'vault/note.md')))
})

it('a file edited after the store lost it goes back up', async t => {
  const run = await mac(t)
  await run.put('vault/note.md', 'a note\n')
  await run.sync()
  await run.put('vault/note.md', 'edited here\n')
  await run.store.delete(`${base}vault/note.md`)
  const report = await run.sync()
  assert.deepEqual(report.deleted, [])
  assert.deepEqual(report.pushed, ['vault/note.md'])
  assert.equal(await run.local('vault/note.md'), 'edited here\n')
  assert.equal(await run.remote('vault/note.md'), 'edited here\n')
})

it('x3: an org folder on the Mac moves both ways, and no members page', async t => {
  const run = await mac(t)
  await run.store.put(
    'orgs/+family/members.html',
    Buffer.from(
      members_html({
        name: '+family',
        founder: { phone: PHONE },
        members: [{ phone: PHONE }]
      })
    )
  )
  await run.store.put(
    'orgs/+family/Projects/plan.md',
    Buffer.from('from the cloud\n')
  )
  const down = await run.sync()
  assert.deepEqual(down.pulled, ['orgs/+family/Projects/plan.md'])
  assert.equal(
    await run.local('orgs/+family/Projects/plan.md'),
    'from the cloud\n'
  )
  assert.deepEqual((await run.sync()).pushed, [])
  await run.put('orgs/+family/Projects/plan.md', 'edited here\n')
  const up = await run.sync()
  assert.deepEqual(up.pushed, ['orgs/+family/Projects/plan.md'])
  assert.equal(
    (await run.store.get('orgs/+family/Projects/plan.md'))?.body.toString(),
    'edited here\n'
  )
  await assert.rejects(read_file(join(run.root, 'orgs/+family/members.html')))
})

it('x3: an org the Mac is not in never comes down', async t => {
  const run = await mac(t)
  await run.store.put(
    'orgs/+other/members.html',
    Buffer.from(
      members_html({ name: '+other', founder: { phone: '+15555550199' } })
    )
  )
  await run.store.put('orgs/+other/note.md', Buffer.from('not mine\n'))
  const report = await run.sync()
  assert.deepEqual(report.pulled, [])
})
