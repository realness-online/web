#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import { readFileSync as read_file_sync } from 'node:fs'
import { resolve, join } from 'node:path'
import { verify_release, verify_install } from './lib/pi-release.js'

const runtime = resolve(import.meta.dirname, '../.pi/runtime')
const release = verify_release(runtime)
const installed = spawn_sync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: runtime, stdio: 'inherit' })
if (installed.error) throw installed.error
assert.equal(installed.status, 0, 'Pinned Pi install failed')
verify_install(runtime)
const manifest = JSON.parse(read_file_sync(join(runtime, 'node_modules/@earendil-works/pi-coding-agent/package.json'), 'utf8'))
assert.equal(manifest.version, release.version, 'Installed Pi differs from release pin')
for (const name of ['pi', 'pi-session-read']) {
  const checked = spawn_sync(process.execPath, ['--check', join(runtime, 'node_modules/@earendil-works/pi-coding-agent', manifest.bin[name])], { encoding: 'utf8' })
  if (checked.error) throw checked.error
  assert.equal(checked.status, 0, `${name}: ${checked.stderr}`)
}
console.log(`Pinned Pi ${release.version} installed from fork ${release.source_commit.slice(0, 12)}`)
