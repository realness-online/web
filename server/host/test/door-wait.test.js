// Recovery runs right after boot and needs the door, which opens on the next reconcile.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { door_path, wait_for_door } from '../src/door.js'

const root = mkdtempSync(
  fileURLToPath(
    new URL('../../../../../artifacts/brayness/door-wait-', import.meta.url)
  )
)
test.after(() => rmSync(root, { recursive: true, force: true }))

test("wait_for_door resolves once the actor's door socket appears", async () => {
  const vsock = join(root, 'vsock.sock')
  const waiting = wait_for_door(vsock, { timeout_ms: 2000, every_ms: 10 })
  setTimeout(() => writeFileSync(door_path(vsock), ''), 50)
  assert.equal(await waiting, true)
})

test('wait_for_door gives up after its timeout', async () => {
  const started = Date.now()
  assert.equal(
    await wait_for_door(join(root, 'never.sock'), {
      timeout_ms: 50,
      every_ms: 10
    }),
    false
  )
  assert.ok(Date.now() - started >= 50)
})
