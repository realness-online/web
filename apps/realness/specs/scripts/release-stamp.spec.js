import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { after, it } from 'node:test'
import { RELEASE_FILE, bundle_of, stamp_of } from '#root/lib/release.js'
import { settled } from '#root/scripts/verify-deploy.js'

const dir = new URL(
  `../../../../artifacts/realness/stamp-${randomUUID()}/`,
  import.meta.url
).pathname
after(() => rm(dir, { recursive: true, force: true }))

it('a bundle hash follows the bytes and ignores the stamp itself', async () => {
  await mkdir(join(dir, 'src'), { recursive: true })
  await writeFile(join(dir, 'package.json'), '{"version":"3.0.0-r"}')
  await writeFile(join(dir, 'src/a.js'), 'one')
  const first = stamp_of(dir)
  assert.equal(first.version, '3.0.0-r')
  await writeFile(join(dir, RELEASE_FILE), JSON.stringify(first))
  assert.equal(bundle_of(dir), first.bundle)
  await writeFile(join(dir, 'src/a.js'), 'two')
  assert.notEqual(bundle_of(dir), first.bundle)
})

it('settled re-checks only failures until they pass or time runs out', async () => {
  const seen = []
  let round = 0
  const results = await settled(
    ['a', 'b'],
    async item => {
      seen.push(item)
      return { ok: item === 'a' || round > 0 }
    },
    60,
    async () => {
      round += 1
    }
  )
  assert.deepEqual(seen, ['a', 'b', 'b'])
  assert.ok(results.every(result => result.ok))

  const never = await settled(['x'], async () => ({ ok: false }), 0)
  assert.equal(never[0].ok, false)
})
