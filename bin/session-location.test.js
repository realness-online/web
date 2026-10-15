import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, copyFileSync as copy_file_sync, symlinkSync as symlink_sync, writeFileSync as write_file_sync, rmSync as rm_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync as spawn_sync } from 'node:child_process'

const scratch = resolve(import.meta.dirname, '../artifacts/realness/session-launch')

test('launcher preserves old history until configured, then passes the vault location', () => {
  mkdir_sync(scratch, { recursive: true })
  const root = mkdtemp_sync(join(scratch, 'case-'))
  try {
    mkdir_sync(join(root, 'bin/lib'), { recursive: true })
    mkdir_sync(join(root, 'apps'))
    symlink_sync(resolve(import.meta.dirname, '../apps/realness'), join(root, 'apps/realness'))
    for (const file of ['pi', 'session-location.js', 'lib/harness-settings.js', 'lib/product.js']) copy_file_sync(join(import.meta.dirname, file), join(root, 'bin', file))
    write_file_sync(join(root, 'package.json'), JSON.stringify({ type: 'module' }))
    mkdir_sync(join(root, 'previous'))
    write_file_sync(join(root, 'previous/pi'), '#!/bin/bash\nprintf "%s\\n" "$PI_CODING_AGENT_SESSION_DIR"\n', { mode: 0o755 })
    const pinned = join(root, '.pi/runtime/node_modules/.bin')
    mkdir_sync(pinned, { recursive: true })
    copy_file_sync(join(root, 'previous/pi'), join(pinned, 'pi'))
    write_file_sync(join(pinned, 'pi-session-read'), '#!/bin/bash\nexit 0\n', { mode: 0o755 })
    const env = { ...process.env, HOME: root, PI_CODING_AGENT_SESSION_DIR: '', PATH: `${root}/previous:${process.env.PATH}` }
    const run = () => spawn_sync('bash', [join(root, 'bin/pi'), '--version'], { env, encoding: 'utf8' })
    assert.equal(run().stdout.trim(), '')
    write_file_sync(join(root, 'package.json'), JSON.stringify({ type: 'module', realness: { sessions: 'vault/Private/Sessions' } }))
    assert.equal(run().stdout.trim(), join(root, 'vault/Private/Sessions'))
    const recall = spawn_sync(process.execPath, ['--input-type=module', '-e', `import { SESSIONS_DIR } from ${JSON.stringify(new URL('../.pi/extensions/memory/index-db.js', import.meta.url).href)}; process.stdout.write(SESSIONS_DIR)`], {
      env: { ...env, PI_CODING_AGENT_SESSION_DIR: join(root, 'vault/Private/Sessions') }, encoding: 'utf8',
    })
    assert.equal(recall.status, 0, recall.stderr)
    assert.equal(recall.stdout, join(root, 'vault/Private/Sessions'))
    env.PI_CODING_AGENT_SESSION_DIR = join(root, 'trial')
    assert.equal(run().stdout.trim(), join(root, 'trial'))
    env.PI_CODING_AGENT_SESSION_DIR = ''
    write_file_sync(join(root, 'package.json'), JSON.stringify({ type: 'module', realness: { sessions: '../escape' } }))
    assert.notEqual(run().status, 0)
  } finally {
    rm_sync(root, { recursive: true, force: true })
  }
})
