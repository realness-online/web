import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { after, it } from 'node:test'
import { claim_turn_sync } from '#root/src/harness/sync-lock.js'

const root = new URL(
  `../../../../artifacts/realness/sync-lock-${randomUUID()}/`,
  import.meta.url
).pathname
after(() => rm(root, { recursive: true, force: true }))

const lock = state => join(state, 'turn-sync.lock')

it('one process claims the turn sync and a second is refused', async () => {
  const state = join(root, 'live')
  assert.equal(claim_turn_sync(state), true)
  assert.equal(claim_turn_sync(state), false)
})

it('a dead owner leaves a lock the next turn-end takes over', async () => {
  const state = join(root, 'dead')
  await mkdir(state, { recursive: true })
  await writeFile(lock(state), '999999')
  assert.equal(claim_turn_sync(state), true)
})

it('a live pid that is not this process still holds the lock', async () => {
  const state = join(root, 'other')
  await mkdir(state, { recursive: true })
  await writeFile(lock(state), '1')
  assert.equal(claim_turn_sync(state), false)
})
