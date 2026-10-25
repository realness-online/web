import assert from 'node:assert/strict'
import { it } from 'node:test'
import { ActorStore } from '#root/src/halo/actors.js'

/** A lock some other work holds and never releases, like a long actor sync. */
const held = { run: () => new Promise(() => {}) }
const free = { run: work => work() }

it('publishing to sync sites does not wait behind the actor lock', async () => {
  const copied = []
  const store = {
    lock: held,
    publishing: free,
    published_dir: '/nowhere',
    copy_out: async (id, tree) => copied.push(tree),
    sync_sites: { publish: async () => ({ files: 1, url: 'http://site/' }) },
    owner_of: () => '+15555550100',
    trace: () => {}
  }
  const published = await Promise.race([
    ActorStore.prototype.publish.call(
      store,
      'a-000000000001',
      '/realness/site'
    ),
    new Promise((_, fail) =>
      setTimeout(() => fail(new Error('publish waited on the actor lock')), 500)
    )
  ])
  assert.equal(published.url, 'http://site/')
  assert.deepEqual(copied, ['/realness/site'])
})
