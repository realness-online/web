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

/** A scratch tree under artifacts/, which is the only root the tool accepts. */
const scratch = name => {
  const dir = join(artifacts, `prune-${name}-${process.pid}`)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}

test('a higher numbered twin goes when its lower number sits beside it at one size', t => {
  const dir = scratch('twin')
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  writeFileSync(join(dir, 'shot-0001.png'), 'same bytes')
  writeFileSync(join(dir, 'shot-0002.png'), 'same bytes')
  writeFileSync(join(dir, 'shot-0003.png'), 'a much longer set of bytes than before')
  writeFileSync(join(dir, 'lonely-0001.png'), 'only one')

  const result = prune({ ARTIFACTS_ROOT: dir })
  assert.equal(result.status, 0, result.stderr)
  assert.ok(!existsSync(join(dir, 'shot-0002.png')), 'an equal twin goes')
  assert.ok(existsSync(join(dir, 'shot-0003.png')), 'a higher number of another size stays')
  assert.ok(!existsSync(join(dir, 'shot-0001.png')) === false, 'the lower number is never the one taken')
  assert.ok(existsSync(join(dir, 'shot-0001.png')), 'the lower number stays')
  assert.ok(existsSync(join(dir, 'lonely-0001.png')), 'a number with no lower twin stays')
})

test('the tool names why each item goes, and counts what it freed', t => {
  const dir = scratch('report')
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  mkdirSync(join(dir, 'work', 'dist'), { recursive: true })
  writeFileSync(join(dir, 'work', 'package.json'), '{}')
  writeFileSync(join(dir, 'work', 'dist', 'bundle.js'), 'x'.repeat(100))
  writeFileSync(join(dir, 'work', '.DS_Store'), 'junk')
  mkdirSync(join(dir, 'work', 'node_modules', 'pkg'), { recursive: true })
  writeFileSync(join(dir, 'work', 'node_modules', 'pkg', 'index.js'), 'y'.repeat(50))

  const dry = spawnSync(process.execPath, [script, '--all'], {
    env: { ...process.env, ARTIFACTS_ROOT: dir },
    encoding: 'utf8'
  })
  assert.equal(dry.status, 0, dry.stderr)
  assert.match(dry.stdout, /would prune work\/dist \(regenerable/)
  assert.match(dry.stdout, /would prune work\/node_modules \(regenerable/)
  assert.match(dry.stdout, /would prune work\/\.DS_Store \(regenerable/)
  assert.match(dry.stdout, /would prune 3 item\(s\), freed \d+ bytes/)
  assert.ok(existsSync(join(dir, 'work', 'dist')), 'a dry run changes nothing')

  const applied = prune({ ARTIFACTS_ROOT: dir })
  assert.match(applied.stdout, /pruned 3 item\(s\)/)
  assert.ok(!existsSync(join(dir, 'work', 'dist')))
  assert.ok(!existsSync(join(dir, 'work', 'node_modules')))
  assert.ok(!existsSync(join(dir, 'work', '.DS_Store')))
  assert.ok(existsSync(join(dir, 'work', 'package.json')), 'the package file stays')
})

test('a dist folder without a package beside it is not treated as build output', t => {
  const dir = scratch('nodist')
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  mkdirSync(join(dir, 'loose', 'dist'), { recursive: true })
  writeFileSync(join(dir, 'loose', 'dist', 'keep.txt'), 'kept')
  mkdirSync(join(dir, 'loose', 'node_modules', 'pkg'), { recursive: true })
  writeFileSync(join(dir, 'loose', 'node_modules', 'pkg', 'x.js'), 'x')

  prune({ ARTIFACTS_ROOT: dir })
  assert.ok(existsSync(join(dir, 'loose', 'dist', 'keep.txt')), 'a bare dist folder stays')
  assert.ok(!existsSync(join(dir, 'loose', 'node_modules')), 'node_modules still goes')
})

test('recent work is left alone unless --all is asked, and stays inside the grace window', t => {
  const dir = scratch('grace')
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  mkdirSync(join(dir, 'fresh', 'node_modules', 'pkg'), { recursive: true })
  writeFileSync(join(dir, 'fresh', 'node_modules', 'pkg', 'x.js'), 'x'.repeat(20))

  const guarded = spawnSync(process.execPath, [script, '--apply', '--quiet'], {
    env: { ...process.env, ARTIFACTS_ROOT: dir },
    encoding: 'utf8'
  })
  assert.equal(guarded.status, 0, guarded.stderr)
  assert.ok(existsSync(join(dir, 'fresh', 'node_modules')), 'a fresh folder is inside the grace window')

  const forced = spawnSync(process.execPath, [script, '--apply', '--all', '--quiet', '--age-minutes', '0'], {
    env: { ...process.env, ARTIFACTS_ROOT: dir },
    encoding: 'utf8'
  })
  assert.equal(forced.status, 0, forced.stderr)
  assert.ok(!existsSync(join(dir, 'fresh', 'node_modules')), '--all with no age limit takes it')
})

test('a root that does not exist yet is quiet and successful', t => {
  const dir = join(artifacts, `prune-missing-${process.pid}`)
  const result = spawnSync(process.execPath, [script], {
    env: { ...process.env, ARTIFACTS_ROOT: dir },
    encoding: 'utf8'
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /would prune 0 item\(s\), freed 0 bytes/)
})
