import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./artifacts-prune.js', import.meta.url))
const artifacts = fileURLToPath(new URL('../artifacts/', import.meta.url))
const root = join(artifacts, `prune-test-${process.pid}`)

function folder(name, marker) {
  const dir = join(root, name)
  mkdirSync(join(dir, 'node_modules/pkg'), { recursive: true })
  writeFileSync(join(dir, 'package.json'), '{}')
  if (marker !== undefined) writeFileSync(join(dir, '.live'), `${marker}\n`)
  return dir
}

const prune = (env = { ARTIFACTS_ROOT: root }) =>
  spawnSync(process.execPath, [script, '--apply', '--all', '--quiet'], { env: { ...process.env, ...env }, encoding: 'utf8' })

test('a .live folder is kept only while its pid runs', t => {
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const dead = spawnSync(process.execPath, ['-e', '']).pid
  const running = folder('running', process.pid)
  const stale = folder('stale', dead)
  const plain = folder('plain')
  const junk = folder('junk', 'not a pid')

  assert.equal(prune().status, 0)
  assert.ok(existsSync(join(running, 'node_modules/pkg')), 'live folder kept')
  assert.ok(!existsSync(join(stale, 'node_modules')), 'dead pid pruned')
  assert.ok(!existsSync(join(plain, 'node_modules')), 'no marker pruned')
  assert.ok(!existsSync(join(junk, 'node_modules')), 'unreadable marker pruned')
})

test('ARTIFACTS_ROOT outside artifacts/ is refused', () => {
  const result = prune({ ARTIFACTS_ROOT: fileURLToPath(new URL('../plans/', import.meta.url)) })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /must be inside/)
})
