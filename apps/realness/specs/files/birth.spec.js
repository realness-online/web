import assert from 'node:assert/strict'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, it } from 'node:test'
import { born, set_born } from '#root/src/files/birth.js'

const dir = await mkdtemp(join(tmpdir(), 'birth-'))
after(() => rm(dir, { recursive: true, force: true }))
const mac = process.platform === 'darwin'

it('born reads a birth time as ISO, or null for a missing file', async () => {
  const file = join(dir, 'a.md')
  await writeFile(file, 'a')
  assert.match(await born(file), /^\d{4}-\d{2}-\d{2}T.*Z$/)
  assert.equal(await born(join(dir, 'none.md')), null)
})

it(
  'set_born moves a Mac birth time back and keeps the modified time',
  { skip: !mac },
  async () => {
    const file = join(dir, 'b.md')
    await writeFile(file, 'b')
    const before = await stat(file, { bigint: true })
    assert.equal(await set_born(file, '2019-03-04T05:06:07.000Z'), true)
    assert.equal(await born(file), '2019-03-04T05:06:07.000Z')
    const after_set = await stat(file, { bigint: true })
    assert.ok(
      Math.abs(Number(after_set.mtimeNs - before.mtimeNs)) < 1000,
      'modified time is back within a microsecond'
    )
  }
)

it('set_born never moves a birth time later', { skip: !mac }, async () => {
  const file = join(dir, 'c.md')
  await writeFile(file, 'c')
  await set_born(file, '2019-03-04T05:06:07.000Z')
  assert.equal(await set_born(file, '2022-01-01T00:00:00.000Z'), false)
  assert.equal(await born(file), '2019-03-04T05:06:07.000Z')
})

it('set_born does nothing off a Mac', async () => {
  const file = join(dir, 'd.md')
  await writeFile(file, 'd')
  assert.equal(await set_born(file, '2019-03-04T05:06:07.000Z', 'linux'), false)
})
