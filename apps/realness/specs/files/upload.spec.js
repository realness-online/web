import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile as write_file } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { disk } from '#root/src/can/disk.js'
import { store_of } from '#root/src/can/store.js'
import { UPLOAD, upload, upload_root } from '#root/src/files/upload.js'

const PHONE = '+15555550100'

/** A Mac harness with the files the upload carries, in a throwaway store. */
const setup = async t => {
  const dir = await mkdtemp(join(tmpdir(), 'upload-'))
  const root = join(dir, 'harness')
  const storage = join(dir, 'store')
  await mkdir(join(root, 'vault'), { recursive: true })
  await write_file(join(root, 'vault/note.md'), 'a note\n')
  await write_file(join(root, 'AGENTS.md'), 'mine\n')
  await write_file(join(root, '.ignore'), '')
  await write_file(join(root, 'rights.html'), '<ul></ul>\n')
  t.after(() => rm(dir, { recursive: true, force: true }))
  return { root, store: store_of(disk(storage)) }
}

it('the lane is the same path the files have on the Mac', () => {
  assert.equal(upload_root({ phone: PHONE }), `people/${PHONE}/`)
  assert.deepEqual(UPLOAD, ['vault', 'AGENTS.md', '.ignore', 'rights.html'])
})

it('the Mac uploads its files where they sit, and a second run is idle', async t => {
  const { root, store } = await setup(t)
  const first = await upload({ phone: PHONE, root, store })
  assert.deepEqual(first.pushed.sort(), [
    '.ignore',
    'AGENTS.md',
    'rights.html',
    'vault/note.md'
  ])
  assert.equal(
    (await store.get(`people/${PHONE}/vault/note.md`)).body.toString(),
    'a note\n'
  )
  assert.equal(
    (await store.get(`people/${PHONE}/AGENTS.md`)).body.toString(),
    'mine\n'
  )
  const second = await upload({ phone: PHONE, root, store })
  assert.deepEqual(second.pushed, [])
  assert.equal(second.unchanged.length, 4)
})

it('the Mac never deletes what the lane holds', async t => {
  const { root, store } = await setup(t)
  await upload({ phone: PHONE, root, store })
  await store.put(`people/${PHONE}/vault/elsewhere.md`, Buffer.from('cloud\n'))
  await rm(join(root, 'vault/note.md'))
  const report = await upload({ phone: PHONE, root, store })
  assert.deepEqual(report.pushed, [])
  assert.equal(
    (await store.get(`people/${PHONE}/vault/note.md`)).body.toString(),
    'a note\n'
  )
  assert.equal(
    (await store.get(`people/${PHONE}/vault/elsewhere.md`)).body.toString(),
    'cloud\n'
  )
})

it('an edit pushes again, and a file over the limit stays home', async t => {
  const { root, store } = await setup(t)
  await upload({ phone: PHONE, root, store })
  await write_file(join(root, 'vault/note.md'), 'an edit\n')
  const big = 'x'.repeat(11 * 1024 * 1024)
  await write_file(join(root, 'vault/big.bin'), big)
  const report = await upload({ phone: PHONE, root, store })
  assert.deepEqual(report.pushed, ['vault/note.md'])
  assert.deepEqual(report.too_big, ['vault/big.bin'])
  assert.equal(
    (await store.get(`people/${PHONE}/vault/note.md`)).body.toString(),
    'an edit\n'
  )
  assert.equal(await store.stat(`people/${PHONE}/vault/big.bin`), null)
})

it('an upload leaves the posters beside the vault alone', async t => {
  const { root, store } = await setup(t)
  await store.put(`people/${PHONE}/posters/1.html`, Buffer.from('poster\n'))
  const report = await upload({ phone: PHONE, root, store })
  assert.ok(report.pushed.every(path => !path.startsWith('posters/')))
  assert.equal(
    (await store.get(`people/${PHONE}/posters/1.html`)).body.toString(),
    'poster\n'
  )
})

it('a skipped name and a missing file stay home', async t => {
  const { root, store } = await setup(t)
  await mkdir(join(root, 'vault/.git'), { recursive: true })
  await write_file(join(root, 'vault/.git/config'), 'secret\n')
  await rm(join(root, 'AGENTS.md'))
  const report = await upload({ phone: PHONE, root, store })
  assert.deepEqual(report.pushed.sort(), [
    '.ignore',
    'rights.html',
    'vault/note.md'
  ])
  assert.equal(await store.stat(`people/${PHONE}/vault/.git/config`), null)
  assert.equal(await store.stat(`people/${PHONE}/AGENTS.md`), null)
})

it('sealed memory uploads to the vault memory folder', async t => {
  const { root, store } = await setup(t)
  await mkdir(join(root, '.pi/agent/memory'), { recursive: true })
  await write_file(join(root, '.pi/agent/memory/2026-01.html'), 'sealed\n')
  const report = await upload({ phone: PHONE, root, store })
  assert.ok(report.pushed.includes('vault/.memory/2026-01.html'))
  assert.equal(
    (
      await store.get(`people/${PHONE}/vault/.memory/2026-01.html`)
    ).body.toString(),
    'sealed\n'
  )
  assert.equal(
    await store.stat(`people/${PHONE}/.pi/agent/memory/2026-01.html`),
    null
  )
})

it('only the work a vault page names uploads', async t => {
  const { root, store } = await setup(t)
  await mkdir(join(root, 'work/named'), { recursive: true })
  await mkdir(join(root, 'work/unused'), { recursive: true })
  await write_file(join(root, 'work/named/a.md'), 'named\n')
  await write_file(join(root, 'work/unused/b.md'), 'unused\n')
  await write_file(
    join(root, 'vault/plan.md'),
    '# Plan\n\nSee [a](../../work/named/a.md).\n\n## Syncs\n\n- work/named\n'
  )
  const report = await upload({ phone: PHONE, root, store })
  assert.ok(report.pushed.includes('work/named/a.md'))
  assert.ok(!report.pushed.includes('work/unused/b.md'))
  assert.equal(await store.stat(`people/${PHONE}/work/unused/b.md`), null)
})

it('a work path no page names stays home', async t => {
  const { root, store } = await setup(t)
  await mkdir(join(root, 'work'), { recursive: true })
  await write_file(join(root, 'work/loose.md'), 'loose\n')
  const report = await upload({ phone: PHONE, root, store })
  assert.deepEqual(report.pushed.sort(), [
    '.ignore',
    'AGENTS.md',
    'rights.html',
    'vault/note.md'
  ])
})

it('files upload several at a time', async t => {
  const { root, store } = await setup(t)
  let open = 0
  let most = 0
  const slow = {
    ...store,
    stat: async key => {
      open += 1
      most = Math.max(most, open)
      await new Promise(done => setTimeout(done, 10))
      open -= 1
      return store.stat(key)
    }
  }
  await upload({ phone: PHONE, root, store: slow })
  assert.equal(most, 4)
})
