import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import { mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, readFileSync as read_file_sync, rmSync as rm_sync, symlinkSync as symlink_sync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'

const product = resolve(import.meta.dirname, '../../..')
const scratch = resolve(product, '../../artifacts/realness/naming-tests')

test('public Realness operator command and legacy alias share help, errors, and dry-run plans', () => {
  const manifest = JSON.parse(read_file_sync(join(product, 'package.json'), 'utf8'))
  assert.equal(manifest.bin.realness, './tools/cli/bin/realness.js')
  assert.equal(manifest.scripts.realness, 'node tools/cli/bin/realness.js')
  mkdir_sync(scratch, { recursive: true })
  const root = mkdtemp_sync(join(scratch, 'commands-'))
  try {
    for (const name of ['realness', 'brayness']) symlink_sync(join(product, manifest.bin[name]), join(root, name))
    const env = { HOME: root, PATH: `${root}:${dirname(process.execPath)}:/usr/bin:/bin`, BRAYNESS_ACTOR: '0', PROFILE: 'desktop' }
    const invoke = (name, args) => spawn_sync(name, args, { env, encoding: 'utf8', timeout: 10_000 })
    for (const args of [['--help'], ['unknown-command'], ['turn-start'], ['frontend', 'build', '--env', 'production', '--dry-run']]) {
      const current = invoke('realness', args)
      const legacy = invoke('brayness', args)
      assert.deepEqual([current.status, current.stdout, current.stderr], [legacy.status, legacy.stdout, legacy.stderr])
      assert.equal(current.error, undefined)
      if (args[0] === '--help') {
        assert.equal(current.status, 0)
        assert.match(current.stdout, /^usage: realness /)
        assert.doesNotMatch(current.stdout, /^\s*brayness /m)
      } else if (args[0] === 'frontend') {
        assert.equal(current.status, 0)
        assert.equal(JSON.parse(current.stdout).environment, 'production')
      } else assert.match(current.stderr, /^realness:/)
    }
  } finally { rm_sync(root, { recursive: true, force: true }) }
})
