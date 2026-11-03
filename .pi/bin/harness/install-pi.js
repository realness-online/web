#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import {
  copyFileSync as copy_file_sync,
  existsSync as exists_sync,
  lstatSync as lstat_sync,
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  renameSync as rename_sync,
  rmSync as rm_sync,
  symlinkSync as symlink_sync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { verify_release, verify_install } from '../lib/pi-release.js'
import { activate_modules, modules_name, modules_ready } from '../lib/pi-runtime.js'

const runtime = resolve(import.meta.dirname, '../../../.pi/runtime')
const release = verify_release(runtime)
const modules = join(runtime, 'node_modules')
const target = join(runtime, modules_name(release))

if (!exists_sync(target) && exists_sync(modules) && !lstat_sync(modules).isSymbolicLink()) {
  if (modules_ready(modules, release)) rename_sync(modules, target)
}

if (!modules_ready(target, release)) {
  rm_sync(target, { recursive: true, force: true })
  const staging = join(runtime, `.install-${process.pid}`)
  rm_sync(staging, { recursive: true, force: true })
  mkdir_sync(staging, { recursive: true })
  for (const name of ['package.json', 'package-lock.json']) copy_file_sync(join(runtime, name), join(staging, name))
  symlink_sync(join(runtime, 'tarballs'), join(staging, 'tarballs'), 'dir')
  try {
    const installed = spawn_sync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['ci', '--ignore-scripts', '--no-audit', '--no-fund'],
      { cwd: staging, stdio: 'inherit' }
    )
    if (installed.error) throw installed.error
    assert.equal(installed.status, 0, 'Pinned Pi install failed')
    verify_install(staging)
    assert.ok(modules_ready(join(staging, 'node_modules'), release), 'Pinned Pi install is incomplete')
    rename_sync(join(staging, 'node_modules'), target)
  } finally {
    rm_sync(staging, { recursive: true, force: true })
  }
}

activate_modules(runtime, target)
verify_install(runtime)
const manifest = JSON.parse(
  read_file_sync(join(runtime, 'node_modules/@earendil-works/pi-coding-agent/package.json'), 'utf8')
)
assert.equal(manifest.version, release.version, 'Installed Pi differs from release pin')
for (const name of ['pi', 'pi-session-read']) {
  const checked = spawn_sync(
    process.execPath,
    ['--check', join(runtime, 'node_modules/@earendil-works/pi-coding-agent', manifest.bin[name])],
    { encoding: 'utf8' }
  )
  if (checked.error) throw checked.error
  assert.equal(checked.status, 0, `${name}: ${checked.stderr}`)
}
console.log(
  `Pinned Pi ${release.version} installed from fork ${release.source_commit.slice(0, 12)} ` +
    `at ${modules_name(release)}`
)
