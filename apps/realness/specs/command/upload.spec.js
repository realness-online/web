import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { disk } from '#root/src/can/disk.js'
import { store_of } from '#root/src/can/store.js'
import { run_upload } from '#root/src/command/upload-command.js'

const PHONE = '+15555550100'

const output = () => {
  let text = ''
  return { write: chunk => (text += chunk), text: () => text }
}

it('realness upload reports what went up, and a second run is idle', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'upload-command-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const root = join(dir, 'harness')
  await mkdir(join(root, 'vault'), { recursive: true })
  await writeFile(join(root, 'vault/note.md'), 'a note\n')
  const store = store_of(disk(join(dir, 'store')))
  const first = output()
  assert.equal(
    await run_upload([], { stdout: first, root, phone: PHONE, store }),
    0
  )
  assert.equal(
    first.text(),
    'pushed: 1\n  vault/note.md\nunchanged: 0\ntoo big: 0\n'
  )
  const second = output()
  await run_upload(['--json'], { stdout: second, root, phone: PHONE, store })
  assert.deepEqual(JSON.parse(second.text()), {
    pushed: [],
    unchanged: ['vault/note.md'],
    too_big: []
  })
})
