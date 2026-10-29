import { it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync, utimesSync, truncateSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../../harness/artifacts-prune.js', import.meta.url))
const artifacts = fileURLToPath(new URL('../../../../artifacts/', import.meta.url))
const root = join(artifacts, `prune-test-${process.pid}`)

function folder(name, marker) {
  const dir = join(root, name)
  mkdirSync(join(dir, 'node_modules/pkg'), { recursive: true })
  writeFileSync(join(dir, 'package.json'), '{}')
  if (marker !== undefined) writeFileSync(join(dir, '.live'), `${marker}\n`)
  return dir
}

const prune = (env = { ARTIFACTS_ROOT: root }) =>
  spawnSync(process.execPath, [script, '--apply', '--all', '--quiet'], {
    env: { ...process.env, ...env },
    encoding: 'utf8'
  })

it('a .live folder is kept only while its pid runs', t => {
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

it('ARTIFACTS_ROOT outside artifacts/ is refused', () => {
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

it('a higher numbered twin goes when its lower number sits beside it at one size', t => {
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

it('the tool names why each item goes, and counts what it freed', t => {
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

it('a dist folder without a package beside it is not treated as build output', t => {
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

it('recent work is left alone unless --all is asked, and stays inside the grace window', t => {
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

it('over the cap, oldest files go first until under it; live folders and recent files stay', t => {
  const dir = scratch('cap')
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  mkdirSync(join(dir, 'running'))
  writeFileSync(join(dir, 'running', '.live'), String(process.pid))
  const put = (name, mb, hoursAgo) => {
    const path = join(dir, name)
    writeFileSync(path, '')
    truncateSync(path, mb * 1_000_000)
    const when = new Date(Date.now() - hoursAgo * 3_600_000)
    utimesSync(path, when, when)
  }
  put('oldest.bin', 1, 50)
  put('older.bin', 1, 40)
  put('old.bin', 1, 30)
  put('running/held.bin', 1, 60)
  put('fresh.bin', 1, 0)
  const invoke = args =>
    spawnSync(process.execPath, [script, '--cap-mb', '3.5', ...args], {
      env: { ...process.env, ARTIFACTS_ROOT: dir },
      encoding: 'utf8'
    })
  const dry = invoke([])
  assert.equal(dry.status, 0, dry.stderr)
  assert.match(dry.stdout, /oldest.bin \(oldest over 3.5 MB cap/)
  assert.ok(existsSync(join(dir, 'oldest.bin')), 'a dry run changes nothing')
  const applied = invoke(['--apply'])
  assert.equal(applied.status, 0, applied.stderr)
  assert.ok(!existsSync(join(dir, 'oldest.bin')))
  assert.ok(!existsSync(join(dir, 'older.bin')))
  assert.ok(existsSync(join(dir, 'old.bin')), 'stops once under the cap')
  assert.ok(existsSync(join(dir, 'running/held.bin')), 'live folder kept')
  assert.ok(existsSync(join(dir, 'fresh.bin')), 'grace window kept')
  assert.doesNotMatch(applied.stdout, /warning/)
})

it('under the cap nothing goes, however old', t => {
  const dir = scratch('undercap')
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const path = join(dir, 'ancient.txt')
  writeFileSync(path, 'old')
  const old = new Date(Date.now() - 90 * 86_400_000)
  utimesSync(path, old, old)
  const result = spawnSync(process.execPath, [script, '--apply', '--quiet'], {
    env: { ...process.env, ARTIFACTS_ROOT: dir },
    encoding: 'utf8'
  })
  assert.equal(result.status, 0, result.stderr)
  assert.ok(existsSync(path))
})

it('data held only by the grace window still warns above the cap', t => {
  const dir = scratch('budget')
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const path = join(dir, 'large.bin')
  writeFileSync(path, '')
  truncateSync(path, 500_000_001)
  const result = spawnSync(process.execPath, [script, '--apply', '--quiet', '--cap-mb', '500'], {
    env: { ...process.env, ARTIFACTS_ROOT: dir },
    encoding: 'utf8'
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /warning: artifacts exceed 500 MB/)
  assert.ok(existsSync(path))
})

it('a root that does not exist yet is quiet and successful', t => {
  const dir = join(artifacts, `prune-missing-${process.pid}`)
  const result = spawnSync(process.execPath, [script], {
    env: { ...process.env, ARTIFACTS_ROOT: dir },
    encoding: 'utf8'
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /would prune 0 item\(s\), freed 0 bytes/)
})
