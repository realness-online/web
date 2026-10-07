import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ActorStore } from '../src/actors.js'

test('publish, revise, restore, and unpublish keep reversible site versions', async () => {
  const root = mkdtempSync(fileURLToPath(new URL('../../../../../artifacts/brayness/site-life-', import.meta.url)))
  const id = 'a-abcdef123456'
  let content = 'first'
  const store = {
    publishedDir: join(root, 'published'),
    versionsDir: join(root, 'versions'),
    lock: { run: work => work() },
    get: actor => { assert.equal(actor, id); return { id } },
    copyOut: async (actor, path, dest) => {
      assert.equal(actor, id)
      mkdirSync(dest, { recursive: true })
      writeFileSync(join(dest, 'index.html'), content)
    },
    trace: () => {},
  }
  Object.setPrototypeOf(store, ActorStore.prototype)
  try {
    await store.publish(id)
    assert.equal(readFileSync(join(store.publishedSite(id), 'index.html'), 'utf8'), 'first')
    content = 'second'
    await store.publish(id)
    const [first] = store.siteVersions(id)
    assert.ok(first.id)
    assert.equal(readFileSync(join(store.publishedSite(id), 'index.html'), 'utf8'), 'second')
    await store.restoreSite(id, first.id)
    assert.equal(readFileSync(join(store.publishedSite(id), 'index.html'), 'utf8'), 'first')
    assert.equal(store.siteVersions(id).length, 1)
    const saved = await store.unpublishSite(id)
    assert.equal(store.publishedSite(id), null)
    await store.restoreSite(id, saved.version)
    assert.equal(readFileSync(join(store.publishedSite(id), 'index.html'), 'utf8'), 'first')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
