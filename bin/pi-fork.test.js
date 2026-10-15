import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync as spawn_sync } from 'node:child_process'
import { copyFileSync as copy_file_sync, renameSync as rename_sync, existsSync as exists_sync, mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, readFileSync as read_file_sync, rmSync as rm_sync, writeFileSync as write_file_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { select_fork, rollback_launcher } from './pi-fork.js'

const fixture = () => {
  const scratch = resolve(import.meta.dirname, '../artifacts/pi-launcher')
  mkdir_sync(scratch, { recursive: true })
  const root = mkdtemp_sync(join(scratch, 'test-'))
  const install = join(root, 'install')
  const binaries = join(install, 'consumer/node_modules/.bin')
  mkdir_sync(binaries, { recursive: true })
  mkdir_sync(join(root, 'bin'))
  copy_file_sync(resolve(import.meta.dirname, 'pi'), join(root, 'bin/pi'))
  write_file_sync(join(root, 'bin/session-location.js'), 'process.stdout.write(process.argv[2] + "/.pi/agent/sessions")')
  write_file_sync(join(install, 'verification.json'), JSON.stringify({ root: install, installed_sdk_cli_pass: true, installed_compressed_write_resume: true, installed_reader_pass: true, installed_remember_pass: true }))
  const executable = (path, body) => write_file_sync(path, `#!/bin/bash\n${body}\n`, { mode: 0o755 })
  executable(join(binaries, 'pi'), 'printf "fork:%s:%s:%s\\n" "$1" "${PI_SESSION_FORMAT:-jsonl}" "$PI_SESSION_READER"')
  executable(join(binaries, 'pi-session-read'), 'exit 0')
  mkdir_sync(join(root, 'previous'))
  executable(join(root, 'previous/pi'), 'printf "previous:%s\\n" "$1"')
  const pinned = join(root, '.pi/runtime/node_modules/.bin')
  mkdir_sync(pinned, { recursive: true })
  copy_file_sync(join(root, 'previous/pi'), join(pinned, 'pi'))
  copy_file_sync(join(binaries, 'pi-session-read'), join(pinned, 'pi-session-read'))
  const run = () => spawn_sync('/bin/bash', [join(root, 'bin/pi'), '--version'], { env: { PATH: `${join(root, 'previous')}:${process.env.PATH}`, HOME: root }, encoding: 'utf8' })
  return { root, install, run }
}

test('selection uses the development fork; rollback restores the checkout pin', () => {
  const f = fixture()
  try {
    assert.equal(f.run().stdout, 'previous:--version\n')
    const binary = select_fork(f)
    const result = f.run()
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, `fork:--version:html.gz:${join(f.root, '.pi/agent/state/pi-forks/install/consumer/node_modules/.bin/pi-session-read')}\n`)
    assert.equal(read_file_sync(join(f.root, '.pi/agent/state/fork-path'), 'utf8'), '.pi/agent/state/pi-forks/install/consumer/node_modules/.bin/pi\n')
    assert.equal(binary, join(f.root, '.pi/agent/state/pi-forks/install/consumer/node_modules/.bin/pi'))
    assert.throws(() => select_fork(f), /already selected/)
    rollback_launcher(f.root)
    rollback_launcher(f.root)
    assert.equal(f.run().stdout, 'previous:--version\n')
    assert.ok(!exists_sync(join(f.root, '.pi/agent/state/fork-path')))
  } finally { rm_sync(f.root, { recursive: true }) }
})

test('the selected install survives removal of staged artifacts', () => {
  const f = fixture()
  try {
    select_fork(f)
    rm_sync(f.install, { recursive: true })
    const result = f.run()
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /^fork:--version:html.gz:/)
    rollback_launcher(f.root)
    const managed = join(f.root, '.pi/agent/state/pi-forks/install')
    select_fork({ root: f.root, install: managed })
    assert.match(f.run().stdout, /^fork:--version:html.gz:/)
  } finally { rm_sync(f.root, { recursive: true }) }
})

test('the selected fork survives renaming the checkout', () => {
  const f = fixture()
  const moved = `${f.root}-moved`
  try {
    select_fork(f)
    rename_sync(f.root, moved)
    const result = spawn_sync('/bin/bash', [join(moved, 'bin/pi'), '--version'], { env: { PATH: process.env.PATH, HOME: moved }, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, `fork:--version:html.gz:${join(moved, '.pi/agent/state/pi-forks/install/consumer/node_modules/.bin/pi-session-read')}\n`)
  } finally { rm_sync(moved, { recursive: true, force: true }) }
})

test('a missing selected fork fails closed instead of falling back', () => {
  const f = fixture()
  try {
    const binary = select_fork(f)
    rm_sync(binary)
    const result = f.run()
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Selected fork is missing/)
    assert.equal(result.stdout, '')
    rollback_launcher(f.root)
    assert.equal(f.run().stdout, 'previous:--version\n')
  } finally { rm_sync(f.root, { recursive: true }) }
})

test('an unverified installation cannot change the launcher', () => {
  const f = fixture()
  try {
    write_file_sync(join(f.install, 'verification.json'), JSON.stringify({ root: f.install }))
    assert.throws(() => select_fork(f), /Missing check/)
    assert.ok(!exists_sync(join(f.root, '.pi/agent/state/fork-path')))
  } finally { rm_sync(f.root, { recursive: true }) }
})
