/**
 * s1: a note saved on disk reaches the index and the open page.
 */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { vault_path, watch_vault_disk } from '#root/src/sync/vault-watch.js'
import { out_path } from '#root/lib/output.js'

const OWNER = '+15555550100'

const make = async () => {
  const root = out_path(
    `vault-watch-${Date.now()}-${Math.random().toString(36).slice(2)}/`
  )
  const vault = join(root, 'vault')
  await mkdir(join(vault, 'Projects'), { recursive: true })
  const index = join(root, 'memory.db')
  const db = new DatabaseSync(index)
  db.exec(
    'CREATE TABLE note (path TEXT PRIMARY KEY, mtime_ms REAL NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL)'
  )
  db.close()
  return { root, vault, index }
}

const heard = (events, ms = 2000) =>
  new Promise(done => {
    const began = Date.now()
    const look = setInterval(() => {
      if (events.length || Date.now() - began > ms) {
        clearInterval(look)
        done(events.slice())
      }
    }, 20)
  })

it('a note saved on disk is indexed and announced within two seconds', async () => {
  const { root, vault, index } = await make()
  const events = []
  const watcher = watch_vault_disk({
    dir: vault,
    index,
    owner: OWNER,
    events: { send: path => events.push(path) }
  })
  try {
    await writeFile(join(vault, 'Projects/realness-hosting.md'), '# Hosting\n')
    const paths = await heard(events)
    assert.deepEqual(paths, [vault_path(OWNER, 'Projects/realness-hosting.md')])
    const db = new DatabaseSync(index)
    try {
      const row = db
        .prepare('SELECT title, text FROM note WHERE path = ?')
        .get('Projects/realness-hosting.md')
      assert.equal(row?.title, 'realness-hosting')
      assert.equal(row?.text, '# Hosting\n')
    } finally {
      db.close()
    }
  } finally {
    watcher.close()
    await rm(root, { recursive: true, force: true })
  }
})

it('a folder plan takes its folder for a title, and a deleted note leaves the index', async () => {
  const { root, vault, index } = await make()
  await mkdir(join(vault, 'Projects/realness-scouts'), { recursive: true })
  const events = []
  const watcher = watch_vault_disk({
    dir: vault,
    index,
    owner: OWNER,
    events: { send: path => events.push(path) }
  })
  const title_of = path => {
    const db = new DatabaseSync(index)
    try {
      return db.prepare('SELECT title FROM note WHERE path = ?').get(path)
        ?.title
    } finally {
      db.close()
    }
  }
  try {
    const path = 'Projects/realness-scouts/index.md'
    const file = join(vault, path)
    await writeFile(file, '# Scouts\n')
    await heard(events, 5000)
    assert.equal(title_of(path), 'realness-scouts')
    events.length = 0
    await rm(file)
    await heard(events, 5000)
    assert.equal(title_of(path), undefined)
  } finally {
    watcher.close()
    await rm(root, { recursive: true, force: true })
  }
})
