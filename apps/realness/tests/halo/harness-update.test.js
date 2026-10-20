import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  readFileSync as read_file_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import {
  STARTER,
  SYSTEM,
  WORKSPACE,
  update_harness
} from '../../src/halo/harness-update.js'

const scratch = file_url_to_path(
  new URL(
    '../../../../artifacts/realness/harness-update-tests/',
    import.meta.url
  )
)

const tree = (root, files) => {
  for (const [path, text] of Object.entries(files)) {
    mkdir_sync(dirname(join(root, path)), { recursive: true })
    write_file_sync(join(root, path), text)
  }
}

const disks = (t, { release, shipped, workspace }) => {
  mkdir_sync(scratch, { recursive: true })
  const root = mkdtemp_sync(join(scratch, 'disks-'))
  t.after(() => rm_sync(root, { recursive: true, force: true }))
  const fresh = join(root, 'template')
  const actor = join(root, 'actor')
  tree(join(fresh, STARTER), release)
  tree(join(actor, STARTER), shipped)
  tree(join(actor, WORKSPACE), workspace)
  const read = path =>
    exists_sync(join(actor, WORKSPACE, path))
      ? read_file_sync(join(actor, WORKSPACE, path), 'utf8')
      : null
  return { fresh, actor, read }
}

test('files the person never touched follow the new release', t => {
  const bridge = '.pi/extensions/chat-bridge/index.js'
  const { fresh, actor, read } = disks(t, {
    release: {
      [bridge]: 'handover',
      '.pi/extensions/chat-bridge/handover.js': 'new'
    },
    shipped: { [bridge]: 'old', 'README.md': 'gone' },
    workspace: { [bridge]: 'old', 'README.md': 'gone' }
  })
  const result = update_harness({ fresh, actor })
  assert.deepEqual(result.updated.sort(), [
    '.pi/extensions/chat-bridge/handover.js',
    bridge
  ])
  assert.deepEqual(result.removed, ['README.md'])
  assert.equal(read(bridge), 'handover')
  assert.equal(read('README.md'), null)
  assert.equal(
    read_file_sync(join(actor, STARTER, bridge), 'utf8'),
    'handover',
    'the next update compares against this release'
  )
})

test('changes the person made stay, including deletions and their own files', t => {
  const { fresh, actor, read } = disks(t, {
    release: {
      'AGENTS.md': 'new rules',
      'notes.md': 'release notes',
      'plan.md': 'new plan'
    },
    shipped: { 'AGENTS.md': 'old rules', 'plan.md': 'old plan' },
    workspace: { 'AGENTS.md': 'my rules', 'notes.md': 'my notes' }
  })
  const result = update_harness({ fresh, actor })
  assert.deepEqual(result.kept.sort(), ['AGENTS.md', 'notes.md', 'plan.md'])
  assert.deepEqual(result.updated, [])
  assert.equal(read('AGENTS.md'), 'my rules')
  assert.equal(read('notes.md'), 'my notes')
  assert.equal(read('plan.md'), null)
})

test('the Pi runtime is left to the template', t => {
  const { fresh, actor, read } = disks(t, {
    release: { '.pi/runtime/package.json': 'new pi' },
    shipped: {},
    workspace: {}
  })
  assert.deepEqual(update_harness({ fresh, actor }).updated, [])
  assert.equal(read('.pi/runtime/package.json'), null)
})

test('the guest agent always follows the release', t => {
  const { fresh, actor } = disks(t, { release: {}, shipped: {}, workspace: {} })
  tree(fresh, { [SYSTEM[0]]: 'streams' })
  tree(actor, { [SYSTEM[0]]: 'old' })
  assert.deepEqual(update_harness({ fresh, actor }).updated, [SYSTEM[0]])
  assert.equal(read_file_sync(join(actor, SYSTEM[0]), 'utf8'), 'streams')
  assert.deepEqual(update_harness({ fresh, actor }).updated, [])
})
