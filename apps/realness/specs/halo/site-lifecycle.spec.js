import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ActorStore } from '../../src/halo/actors.js'

it('publish, revise, restore, and unpublish keep reversible site versions', async () => {
  const root = mkdtempSync(
    fileURLToPath(
      new URL('../../../../artifacts/realness/site-life-', import.meta.url)
    )
  )
  const id = 'a-abcdef123456'
  let content = 'first'
  const store = {
    published_dir: join(root, 'published'),
    versions_dir: join(root, 'versions'),
    lock: { run: work => work() },
    publishing: { run: work => work() },
    get: actor => {
      assert.equal(actor, id)
      return { id }
    },
    copy_out: async (actor, path, dest) => {
      assert.equal(actor, id)
      mkdirSync(dest, { recursive: true })
      writeFileSync(join(dest, 'index.html'), content)
    },
    trace: () => {}
  }
  Object.setPrototypeOf(store, ActorStore.prototype)
  try {
    await store.publish(id)
    assert.equal(
      readFileSync(join(store.published_site(id), 'index.html'), 'utf8'),
      'first'
    )
    content = 'second'
    await store.publish(id)
    const [first] = store.site_versions(id)
    assert.ok(first.id)
    assert.equal(
      readFileSync(join(store.published_site(id), 'index.html'), 'utf8'),
      'second'
    )
    await store.restore_site(id, first.id)
    assert.equal(
      readFileSync(join(store.published_site(id), 'index.html'), 'utf8'),
      'first'
    )
    assert.equal(store.site_versions(id).length, 1)
    const saved = await store.unpublish_site(id)
    assert.equal(store.published_site(id), null)
    await store.restore_site(id, saved.version)
    assert.equal(
      readFileSync(join(store.published_site(id), 'index.html'), 'utf8'),
      'first'
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
