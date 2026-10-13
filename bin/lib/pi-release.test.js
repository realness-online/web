import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash as create_hash } from 'node:crypto'
import { mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, writeFileSync as write_file_sync, rmSync as rm_sync, symlinkSync as symlink_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { verify_release, verify_install } from './pi-release.js'

const fixture = () => {
  const scratch = resolve(import.meta.dirname, '../../artifacts/realness/release-tests')
  mkdir_sync(scratch, { recursive: true })
  const runtime = mkdtemp_sync(join(scratch, 'pin-'))
  mkdir_sync(join(runtime, 'tarballs'))
  const archive = 'tarballs/pi-test.tgz'
  const bytes = Buffer.from('test archive bytes')
  write_file_sync(join(runtime, archive), bytes)
  const release = { version: '0.99.1', source_commit: 'a'.repeat(40), upstream_commit: 'b'.repeat(40), upstream_tag: 'v0.99.1', archives: { [archive]: create_hash('sha256').update(bytes).digest('hex') } }
  const manifest = { dependencies: { '@earendil-works/pi-coding-agent': `file:./${archive}` } }
  const save = () => {
    write_file_sync(join(runtime, 'release.json'), JSON.stringify(release))
    write_file_sync(join(runtime, 'package.json'), JSON.stringify(manifest))
  }
  save()
  return { runtime, archive, release, manifest, save, cleanup: () => rm_sync(runtime, { recursive: true, force: true }) }
}

test('a release pin records source, upstream, and exact archive bytes', () => {
  const f = fixture()
  try { assert.deepEqual(verify_release(f.runtime), f.release) }
  finally { f.cleanup() }
})

test('a changed archive is refused before installation', () => {
  const f = fixture()
  try {
    write_file_sync(join(f.runtime, f.archive), 'changed bytes')
    assert.throws(() => verify_release(f.runtime), /Fork archive changed/)
  } finally { f.cleanup() }
})

test('unapproved registry dependencies are refused before installation', () => {
  const f = fixture()
  try {
    f.manifest.dependencies['@earendil-works/pi-coding-agent'] = 'latest'
    f.save()
    assert.throws(() => verify_release(f.runtime))
  } finally { f.cleanup() }
})

test('archive paths cannot leave the pinned runtime', () => {
  const f = fixture()
  try {
    f.release.archives = { '../outside.tgz': 'a'.repeat(64) }
    f.save()
    assert.throws(() => verify_release(f.runtime))
  } finally { f.cleanup() }
})

test('installed commands must link inside their own runtime', t => {
  const { runtime, cleanup } = fixture()
  t.after(cleanup)
  const bin = join(runtime, 'node_modules/.bin')
  const cli = join(runtime, 'node_modules/pi/cli.js')
  mkdir_sync(join(runtime, 'node_modules/pi'), { recursive: true })
  write_file_sync(cli, '')
  mkdir_sync(bin)
  symlink_sync('../pi/cli.js', join(bin, 'pi'))
  assert.equal(verify_install(runtime), 1)
  symlink_sync(cli, join(bin, 'absolute'))
  assert.throws(() => verify_install(runtime), /absolute link.*absolute/)
  rm_sync(join(bin, 'absolute'))
  symlink_sync('../../../outside.js', join(bin, 'escape'))
  assert.throws(() => verify_install(runtime), /leaves the runtime.*escape/)
  rm_sync(join(bin, 'escape'))
  symlink_sync('../pi/missing.js', join(bin, 'dangling'))
  assert.throws(() => verify_install(runtime), /dangling.*dangling/)
})
