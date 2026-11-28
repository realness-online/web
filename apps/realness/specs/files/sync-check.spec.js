import { after, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  rmSync as rm_sync,
  utimesSync as utimes_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { disk } from '#root/src/can/disk.js'
import { store_of } from '#root/src/can/store.js'
import { SYNC_HASH } from '#root/src/can/marks.js'
import { item_html } from '#root/lib/items.js'
import { members_html } from '#root/src/can/members.js'
import {
  SEEN,
  changed,
  changed_folders,
  edited_folders,
  read_page,
  read_seen,
  seen_html,
  turn_check,
  turn_line
} from '#root/src/files/sync-check.js'

const A = '+14155550001'
const dirs = []
after(() => dirs.forEach(dir => rm_sync(dir, { recursive: true, force: true })))

const buckets = () => {
  const root = mkdtemp_sync(join(tmpdir(), 'sync-check-'))
  dirs.push(root)
  const store = store_of(disk(root))
  return {
    store,
    put_page: (fields, folders = {}) =>
      store.put(
        `people/${A}/${SYNC_HASH}`,
        Buffer.from(
          item_html('sync-hash', fields) +
            Object.entries(folders)
              .map(([name, hash]) => item_html('folder', { name, hash }))
              .join('')
        )
      )
  }
}

const pass = ({ seen = null, admitted = {} } = {}) => {
  const calls = []
  const saved = []
  return {
    calls,
    saved,
    args: {
      root: '/tmp/harness',
      phone: A,
      record: '/tmp/two-way.json',
      trash: '/tmp/trash',
      read_seen_page: async () => seen,
      save_seen: async html => saved.push(html),
      door: async one => (calls.push(one), { admitted }),
      now: () => new Date('2026-11-23T00:00:00.000Z')
    }
  }
}

it('an unseen page runs the door and saves what it saw', async () => {
  const { store, put_page } = buckets()
  await put_page({ vault: 'v1', quarantine: '' })
  const one = pass({ admitted: { moved: ['a'], waiting: [] } })
  const line = await turn_check({ store, ...one.args })
  assert.equal(one.calls.length, 1)
  assert.equal(one.calls[0].root, '/tmp/harness')
  assert.equal(one.calls[0].folders, undefined)
  assert.equal(one.saved.length, 1)
  assert.equal(read_seen(one.saved[0]).vault, 'v1')
  assert.equal(read_seen(one.saved[0]).at, '2026-11-23T00:00:00.000Z')
  assert.equal(turn_line(line), 'Sync: 1 arrived, 0 wait')
})

it('the door opens only the folders whose hash moved', async () => {
  const { store, put_page } = buckets()
  await put_page(
    { vault: 'v2', quarantine: 'q1' },
    { 'vault/Projects': 'p2', 'vault/Sessions': 's1' }
  )
  const seen = seen_html({
    vault: 'v1',
    quarantine: 'q1',
    folders: {
      'vault/Projects': 'p1',
      'vault/Sessions': 's1',
      'vault/Gone': 'g1'
    }
  })
  const one = pass({ seen })
  const started = []
  await turn_check({
    store,
    ...one.args,
    on_start: folders => started.push(folders)
  })
  assert.deepEqual(one.calls[0].folders, ['vault/Gone', 'vault/Projects'])
  assert.deepEqual(started, [['vault/Gone', 'vault/Projects']])
  assert.deepEqual(read_seen(one.saved[0]).folders, {
    'vault/Projects': 'p2',
    'vault/Sessions': 's1'
  })
})

it('a Mac edit opens its folder when the cloud is quiet', async () => {
  const { store, put_page } = buckets()
  await put_page({ vault: 'v1', quarantine: 'q1' })
  const one = pass({ seen: seen_html({ vault: 'v1', quarantine: 'q1' }) })
  await turn_check({
    store,
    ...one.args,
    edited: async () => ['vault/Projects']
  })
  assert.deepEqual(one.calls[0].folders, ['vault/Projects'])
})

it('file dates name the folders saved since the last run', async () => {
  const root = mkdtemp_sync(join(tmpdir(), 'edited-'))
  dirs.push(root)
  const old = new Date('2026-01-01T00:00:00.000Z')
  const put = path => {
    mkdir_sync(join(root, path, '..'), { recursive: true })
    write_file_sync(join(root, path), 'x')
  }
  for (const path of ['vault/top.md', 'vault/Old/a.md', 'vault/New/Deep/b.md'])
    put(path)
  for (const path of ['vault', 'vault/top.md', 'vault/Old', 'vault/Old/a.md'])
    utimes_sync(join(root, path), old, old)
  assert.deepEqual(await edited_folders(root, '2026-06-01T00:00:00.000Z'), [
    'vault/New'
  ])
  assert.deepEqual(await edited_folders(root, ''), [
    'vault',
    'vault/New',
    'vault/Old'
  ])
})

it('a moved quarantine hash opens the quarantine', () => {
  assert.deepEqual(
    changed_folders(
      { quarantine: 'q2', folders: { vault: 'a' } },
      { quarantine: 'q1', folders: { vault: 'a' } }
    ),
    ['quarantine']
  )
})

it('a page the seen hashes match costs nothing', async () => {
  const { store, put_page } = buckets()
  await put_page({ vault: 'v1', quarantine: 'q1' })
  const one = pass({ seen: seen_html({ vault: 'v1', quarantine: 'q1' }) })
  assert.equal(await turn_check({ store, ...one.args }), null)
  assert.equal(one.calls.length, 0)
  assert.equal(one.saved.length, 0)
})

it('a quarantine hash alone is a change', async () => {
  const { store, put_page } = buckets()
  await put_page({ vault: 'v1', quarantine: 'q2' })
  const one = pass({
    seen: seen_html({ vault: 'v1', quarantine: 'q1' }),
    admitted: { moved: [], waiting: ['x'] }
  })
  const line = await turn_check({ store, ...one.args })
  assert.equal(one.calls.length, 1)
  assert.equal(
    turn_line(line),
    'Sync: 0 arrived, 1 wait, new files in the cloud queue'
  )
  assert.equal(read_seen(one.saved[0]).quarantine, 'q2')
})

it('no page at all means no check and no line', async () => {
  const { store } = buckets()
  const one = pass()
  assert.equal(await turn_check({ store, ...one.args }), null)
  assert.equal(one.calls.length, 0)
})

it('the seen page reads back what it wrote', async () => {
  const html = seen_html(
    { vault: 'v9', quarantine: 'q9' },
    '2026-11-23T01:00:00.000Z'
  )
  assert.deepEqual(read_seen(html), {
    vault: 'v9',
    quarantine: 'q9',
    at: '2026-11-23T01:00:00.000Z',
    folders: {}
  })
  assert.equal(read_seen(null).vault, '')
})

it('read_page finds the page and its folders', async () => {
  const { store, put_page } = buckets()
  await put_page({ vault: 'v1', quarantine: 'q1' }, { 'vault/Plans': 'p1' })
  const page = await read_page(store, A)
  assert.equal(page.vault, 'v1')
  assert.equal(page.folders['vault/Plans'], 'p1')
  assert.equal(await read_page(store, '+14155550002'), null)
})

it('changed ignores a missing page', () => {
  assert.equal(changed(null, { vault: '', quarantine: '' }), false)
  assert.equal(changed({ vault: 'v1' }, { vault: 'v1' }), false)
  assert.equal(changed({ vault: 'v2' }, { vault: 'v1' }), true)
})

it('the seen page sits beside the record', () => {
  assert.equal(SEEN, 'sync-seen.html')
})

it('an org folder whose hash moved opens alone', async () => {
  const { store, put_page } = buckets()
  await put_page({ vault: 'v1', quarantine: 'q1' })
  await store.put(
    'orgs/+fam/members.html',
    Buffer.from(members_html({ name: '+fam', founder: { phone: A } }))
  )
  await store.put(
    `orgs/+fam/${SYNC_HASH}`,
    Buffer.from(
      item_html('sync-hash', { vault: 'o2', quarantine: '' }) +
        item_html('folder', { name: 'data/stories', hash: 's2' }) +
        item_html('folder', { name: 'data/reflections', hash: 'r1' })
    )
  )
  const seen = seen_html({
    vault: 'v1',
    quarantine: 'q1',
    folders: {
      'orgs/+fam/data/stories': 's1',
      'orgs/+fam/data/reflections': 'r1'
    }
  })
  const one = pass({ seen })
  await turn_check({ store, ...one.args })
  assert.deepEqual(one.calls[0].folders, ['orgs/+fam/data/stories'])
  assert.equal(read_seen(one.saved[0]).folders['orgs/+fam/data/stories'], 's2')
})

it('org pages the hashes match cost nothing', async () => {
  const { store, put_page } = buckets()
  await put_page({ vault: 'v1', quarantine: 'q1' })
  await store.put(
    'orgs/+fam/members.html',
    Buffer.from(members_html({ name: '+fam', founder: { phone: A } }))
  )
  await store.put(
    `orgs/+fam/${SYNC_HASH}`,
    Buffer.from(item_html('folder', { name: 'data/stories', hash: 's1' }))
  )
  const seen = seen_html({
    vault: 'v1',
    quarantine: 'q1',
    folders: { 'orgs/+fam/data/stories': 's1' }
  })
  const one = pass({ seen })
  assert.equal(await turn_check({ store, ...one.args }), null)
  assert.equal(one.calls.length, 0)
})

it('file dates name the org folders saved since the last run', async () => {
  const root = mkdtemp_sync(join(tmpdir(), 'edited-org-'))
  dirs.push(root)
  const old = new Date('2026-01-01T00:00:00.000Z')
  mkdir_sync(join(root, 'orgs/+fam/data/old'), { recursive: true })
  mkdir_sync(join(root, 'orgs/+fam/data/new'), { recursive: true })
  write_file_sync(join(root, 'orgs/+fam/data/old/a.html'), 'x')
  write_file_sync(join(root, 'orgs/+fam/data/new/b.html'), 'x')
  for (const path of [
    'orgs',
    'orgs/+fam',
    'orgs/+fam/data',
    'orgs/+fam/data/old',
    'orgs/+fam/data/old/a.html'
  ])
    utimes_sync(join(root, path), old, old)
  assert.deepEqual(await edited_folders(root, '2026-06-01T00:00:00.000Z'), [
    'orgs/+fam/data/new'
  ])
})
