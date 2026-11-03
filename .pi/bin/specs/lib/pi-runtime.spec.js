import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  existsSync as exists_sync,
  lstatSync as lstat_sync,
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  readFileSync as read_file_sync,
  readlinkSync as readlink_sync,
  rmSync as rm_sync,
  symlinkSync as symlink_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { activate_modules, modules_name, modules_ready } from '../../lib/pi-runtime.js'

const release = {
  version: '1.0.0',
  source_commit: 'a'.repeat(40),
  archives: { 'tarballs/pi.tgz': 'b'.repeat(64) }
}

const scratch = () => {
  const root = resolve(import.meta.dirname, '../../../../artifacts/realness/runtime-tests')
  mkdir_sync(root, { recursive: true })
  return mkdtemp_sync(join(root, 'runtime-'))
}

const install = (modules, version = release.version) => {
  const agent = join(modules, '@earendil-works/pi-coding-agent')
  mkdir_sync(join(agent, 'dist'), { recursive: true })
  mkdir_sync(join(modules, '.bin'), { recursive: true })
  write_file_sync(join(agent, 'package.json'), JSON.stringify({ version }))
  write_file_sync(join(agent, 'dist/cli.js'), '')
  symlink_sync('../@earendil-works/pi-coding-agent/dist/cli.js', join(modules, '.bin/pi'))
}

it('a release name follows its source and exact archives', () => {
  const name = modules_name(release)
  assert.match(name, /^node_modules-aaaaaaaaaaaa-[a-f0-9]{10}$/)
  assert.equal(name, modules_name({ ...release }))
  assert.notEqual(name, modules_name({ ...release, archives: { 'tarballs/pi.tgz': 'c'.repeat(64) } }))
})

it('modules are ready only when the version and every command link agree', t => {
  const runtime = scratch()
  t.after(() => rm_sync(runtime, { recursive: true, force: true }))
  const modules = join(runtime, 'node_modules')
  install(modules)
  assert.equal(modules_ready(modules, release), true)
  assert.equal(modules_ready(modules, { ...release, version: '2.0.0' }), false)
  rm_sync(join(modules, '@earendil-works/pi-coding-agent/dist/cli.js'))
  assert.equal(modules_ready(modules, release), false)
})

it('activation keeps a real node_modules as a backup and links the release', t => {
  const runtime = scratch()
  t.after(() => rm_sync(runtime, { recursive: true, force: true }))
  const target = join(runtime, 'node_modules-new')
  install(target)
  mkdir_sync(join(runtime, 'node_modules/old'), { recursive: true })
  write_file_sync(join(runtime, 'node_modules/old/file'), 'old')
  const backup = activate_modules(runtime, target)
  assert.ok(backup)
  assert.equal(read_file_sync(join(backup, 'old/file'), 'utf8'), 'old')
  assert.equal(lstat_sync(join(runtime, 'node_modules')).isSymbolicLink(), true)
  assert.equal(readlink_sync(join(runtime, 'node_modules')), 'node_modules-new')
  assert.ok(exists_sync(join(runtime, 'node_modules/@earendil-works/pi-coding-agent/package.json')))
})

it('activation replaces a link and leaves the earlier release in place', t => {
  const runtime = scratch()
  t.after(() => rm_sync(runtime, { recursive: true, force: true }))
  const first = join(runtime, 'node_modules-first')
  const second = join(runtime, 'node_modules-second')
  install(first)
  install(second)
  activate_modules(runtime, first)
  assert.equal(activate_modules(runtime, second), null)
  assert.equal(readlink_sync(join(runtime, 'node_modules')), 'node_modules-second')
  assert.ok(exists_sync(first), 'a running session keeps its earlier files')
  assert.match(read_file_sync(join(first, '@earendil-works/pi-coding-agent/package.json'), 'utf8'), /1\.0\.0/)
})
