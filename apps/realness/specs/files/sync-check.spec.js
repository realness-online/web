import { after, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { disk } from '../../src/can/disk.js'
import { store_of } from '../../src/can/store.js'
import { SYNC_HASH } from '../../src/can/marks.js'
import { item_html } from '../../lib/items.js'
import {
  SEEN,
  changed,
  read_page,
  read_seen,
  seen_html,
  turn_check,
  turn_line
} from '../../src/files/sync-check.js'

const A = '+14155550001'
const dirs = []
after(() => dirs.forEach(dir => rmSync(dir, { recursive: true, force: true })))

const buckets = () => {
  const root = mkdtempSync(join(tmpdir(), 'sync-check-'))
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
  assert.equal(one.saved.length, 1)
  assert.equal(read_seen(one.saved[0]).vault, 'v1')
  assert.equal(read_seen(one.saved[0]).at, '2026-11-23T00:00:00.000Z')
  assert.equal(turn_line(line), 'Sync: 1 arrived, 0 wait')
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
    at: '2026-11-23T01:00:00.000Z'
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
