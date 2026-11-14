import assert from 'node:assert/strict'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { it } from 'node:test'
import { version_drift } from '../../lib/pi-version.js'

const root = resolve(import.meta.dirname, '../../../..')
const scratch = () => {
  const folder = resolve(import.meta.dirname, '../../../../artifacts/realness/pi-version-tests')
  mkdir_sync(folder, { recursive: true })
  return mkdtemp_sync(join(folder, 'case-'))
}

const write = (path, body) => {
  mkdir_sync(join(path, '..'), { recursive: true })
  write_file_sync(path, body)
}

const checkout = (version, pin = version) => {
  const folder = scratch()
  const runtime = join(folder, '.pi/runtime')
  write(join(runtime, 'release.json'), JSON.stringify({ version: pin }))
  if (version) {
    const install = join(folder, '.pi/agent/state/pi-forks/release')
    write(join(install, 'verification.json'), JSON.stringify({ version }))
    write(
      join(install, 'consumer/node_modules/@earendil-works/pi-coding-agent/package.json'),
      JSON.stringify({ version })
    )
    write(
      join(folder, '.pi/agent/state/fork-path'),
      `${join('.pi/agent/state/pi-forks/release/consumer/node_modules/.bin/pi')}\n`
    )
  }
  return { folder, runtime }
}

it('a selected fork and the checkout pin name one version', t => {
  const { folder, runtime } = checkout('1.5.0')
  t.after(() => rm_sync(folder, { recursive: true, force: true }))
  assert.deepEqual(version_drift(folder, runtime), [])
})

it('a moved fork names the drift against the pin', t => {
  const { folder, runtime } = checkout('1.5.0', '1.4.0')
  t.after(() => rm_sync(folder, { recursive: true, force: true }))
  assert.deepEqual(version_drift(folder, runtime), ['.pi/agent/state/fork-path names 1.5.0, pin names 1.4.0'])
})

it('a checkout with no selected fork has no drift', t => {
  const { folder, runtime } = checkout(null)
  t.after(() => rm_sync(folder, { recursive: true, force: true }))
  assert.deepEqual(version_drift(folder, runtime), [])
})

it('this checkout names one Pi version everywhere', () => {
  assert.deepEqual(version_drift(root), [])
})
