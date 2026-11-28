/**
 * z4: the Mac's `vault/` goes up only, its copy winning over the cloud's, and
 * no `.conflict` file is ever written. A file the Mac deleted goes from the
 * store when the record knew it; a file the record never saw stays. Every write
 * is guarded by the version it started from. `quarantine/` and org folders stay
 * both ways: others' changes come in through them.
 */
import assert from 'node:assert/strict'
import { randomUUID as random_uuid } from 'node:crypto'
import {
  mkdir,
  readdir,
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
import { zip } from '#root/src/files/zip.js'
import { PREVIEW_LINK } from '#root/src/files/preview-styles.js'
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

it('the Mac copy wins when only the cloud moved', async t => {
  const run = await mac(t)
  await run.put('vault/note.md', 'a note\n')
  await run.sync()
  await run.store.put(`${base}vault/note.md`, Buffer.from('from the cloud\n'))
  const report = await run.sync()
  assert.deepEqual(report.pushed, ['vault/note.md'])
  assert.deepEqual(report.pulled, [])
  assert.equal(await run.local('vault/note.md'), 'a note\n')
  assert.equal(await run.remote('vault/note.md'), 'a note\n')
})

it('a file only the cloud holds stays in the cloud', async t => {
  const run = await mac(t)
  await run.store.put(`${base}vault/theirs.md`, Buffer.from('theirs\n'))
  const report = await run.sync()
  assert.deepEqual(report.pulled, [])
  assert.equal(await run.remote('vault/theirs.md'), 'theirs\n')
  await assert.rejects(read_file(join(run.root, 'vault/theirs.md')))
})

it('named folders move alone; vault alone is its top files', async t => {
  const run = await mac(t)
  await run.put('vault/note.md', 'top\n')
  await run.put('vault/A/a.md', 'a\n')
  await run.put('vault/B/b.md', 'b\n')
  await run.sync()
  for (const path of ['vault/note.md', 'vault/A/a.md', 'vault/B/b.md'])
    await run.store.put(`${base}${path}`, Buffer.from('cloud\n'))
  const report = await two_way({
    root: run.root,
    store: run.store,
    phone: PHONE,
    record: run.record,
    folders: ['vault', 'vault/A']
  })
  assert.deepEqual(report.pushed.sort(), ['vault/A/a.md', 'vault/note.md'])
  assert.equal(await run.local('vault/B/b.md'), 'b\n')
  assert.equal(await run.remote('vault/B/b.md'), 'cloud\n')
  assert.equal(await run.remote('vault/note.md'), 'top\n')
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

it('both moving keeps the Mac copy, and no conflict file is written', async t => {
  const run = await mac(t)
  await run.put('vault/note.md', 'a note\n')
  await run.sync()
  await run.put('vault/note.md', 'edited here\n')
  await run.store.put(`${base}vault/note.md`, Buffer.from('edited there\n'))
  const report = await run.sync()
  assert.deepEqual(report.pushed, ['vault/note.md'])
  assert.deepEqual(report.kept_both, [])
  assert.equal(await run.local('vault/note.md'), 'edited here\n')
  assert.equal(await run.remote('vault/note.md'), 'edited here\n')
  assert.deepEqual(await readdir(join(run.root, 'vault')), ['note.md'])
  assert.equal(await run.store.get(`${base}vault/note.conflict.md`), null)
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

it('a file the store lost goes back up', async t => {
  const run = await mac(t)
  await run.put('vault/note.md', 'a note\n')
  await run.sync()
  await run.store.delete(`${base}vault/note.md`)
  const report = await run.sync()
  assert.deepEqual(report.pushed, ['vault/note.md'])
  assert.deepEqual(report.deleted, [])
  assert.equal(await run.remote('vault/note.md'), 'a note\n')
})

it('w3: a file the Mac deleted stays deleted, and goes from the store', async t => {
  const run = await mac(t)
  await run.put('vault/note.md', 'a note\n')
  await run.sync()
  await rm(join(run.root, 'vault/note.md'))
  const report = await run.sync()
  assert.deepEqual(report.deleted, ['vault/note.md'])
  assert.deepEqual(report.pulled, [])
  assert.equal(await run.remote('vault/note.md'), undefined)
  const again = await run.sync()
  assert.deepEqual(again.pulled, [])
  await assert.rejects(read_file(join(run.root, 'vault/note.md')))
})

it('a vault page goes up linking the Realness stylesheets', async t => {
  const run = await mac(t)
  await run.put(
    'vault/page.html',
    '<!doctype html>\n<title>Page</title>\n<p>hi</p>\n'
  )
  await run.sync()
  const up = await run.remote('vault/page.html')
  assert.match(up, /href="https:\/\/realness\.online\/style\.css"/)
  assert.equal(await run.local('vault/page.html'), up)
  const again = await run.sync()
  assert.deepEqual(again.pushed, [])
})

it('w3: a file sync skips is never pulled and never deleted', async t => {
  const run = await mac(t)
  await run.store.put(`${base}vault/.obsidian/app.json`, '{}')
  await run.put('vault/.obsidian/app.json', '{}')
  await run.sync()
  const again = await run.sync()
  assert.deepEqual(again.deleted, [])
  assert.deepEqual(again.pulled, [])
  assert.equal(await run.remote('vault/.obsidian/app.json'), '{}')
})

it('a file the Mac deleted goes, even when the cloud edited it since', async t => {
  const run = await mac(t)
  await run.put('vault/note.md', 'a note\n')
  await run.sync()
  await rm(join(run.root, 'vault/note.md'))
  await run.store.put(`${base}vault/note.md`, 'edited there\n')
  const report = await run.sync()
  assert.deepEqual(report.deleted, ['vault/note.md'])
  assert.deepEqual(report.pulled, [])
  assert.equal(await run.remote('vault/note.md'), undefined)
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

it('named org folders move alone, and an org left unnamed stays', async t => {
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
  await run.store.put('orgs/+family/data/a/one.html', Buffer.from('a\n'))
  await run.store.put('orgs/+family/data/b/two.html', Buffer.from('b\n'))
  const named = await two_way({
    root: run.root,
    store: run.store,
    phone: PHONE,
    record: run.record,
    folders: ['orgs/+family/data/a']
  })
  assert.deepEqual(named.pulled, ['orgs/+family/data/a/one.html'])
  await assert.rejects(
    read_file(join(run.root, 'orgs/+family/data/b/two.html'))
  )
  const none = await two_way({
    root: run.root,
    store: run.store,
    phone: PHONE,
    record: run.record,
    folders: ['vault']
  })
  assert.deepEqual(none.pulled, [])
})

const ENTRY =
  '<article itemscope itemtype="/sessions/message" itemid="/sessions/x/1"></article>\n'
const LINK = `${PREVIEW_LINK}\n`

it('w5: a packed session goes up as plain x.html, styled, and never as x.html.gz', async t => {
  const run = await mac(t)
  await mkdir(join(run.root, 'vault/Sessions'), { recursive: true })
  await write_file(
    join(run.root, 'vault/Sessions/s.html.gz'),
    zip(Buffer.from(ENTRY))
  )
  const report = await run.sync()
  assert.deepEqual(report.pushed, ['vault/Sessions/s.html'])
  assert.equal(await run.remote('vault/Sessions/s.html'), LINK + ENTRY)
  assert.equal(await run.remote('vault/Sessions/s.html.gz'), undefined)
  const again = await run.sync()
  assert.deepEqual(again.pushed, [])
  assert.deepEqual(again.unchanged, ['vault/Sessions/s.html'])
})

it('w5: a session under its old cloud name moves to x.html once', async t => {
  const run = await mac(t)
  await mkdir(join(run.root, 'vault/Sessions'), { recursive: true })
  await mkdir(dirname(run.record), { recursive: true })
  const packed = zip(Buffer.from(ENTRY))
  await write_file(join(run.root, 'vault/Sessions/s.html.gz'), packed)
  await run.store.put(`${base}vault/Sessions/s.html.gz`, packed)
  const listed = await run.store.walk_meta(`${base}vault/Sessions/`)
  await write_file(
    run.record,
    JSON.stringify({ 'vault/Sessions/s.html.gz': listed['s.html.gz'].version })
  )
  const report = await run.sync()
  assert.deepEqual(report.pushed, ['vault/Sessions/s.html'])
  assert.deepEqual(report.deleted, ['vault/Sessions/s.html.gz'])
  assert.equal(await run.remote('vault/Sessions/s.html.gz'), undefined)
  assert.equal(await run.remote('vault/Sessions/s.html'), LINK + ENTRY)
})
