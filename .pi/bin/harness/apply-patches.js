#!/usr/bin/env node
import { spawnSync as spawn_sync } from 'node:child_process'
import { existsSync as exists_sync, readFileSync as read_file_sync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../../..')
const patch = '.pi/patches/pi-claude-oauth-adapter.patch'
const target = '.pi/agent/npm/node_modules/pi-claude-oauth-adapter/extensions/index.ts'
const anchor = 'outer.push(createAnthropicErrorEvent(anthropicModel, footerStatus.message));'
const fixed = 'if (footerStatus.severity === "error") {'

const check_only = process.argv.includes('--check')

if (!exists_sync(resolve(root, target))) process.exit(0)

const source = read_file_sync(resolve(root, target), 'utf8')

if (source.includes(fixed)) process.exit(0)

if (!source.includes(anchor)) {
  console.error(`adapter patch no longer fits: ${target} changed upstream`)
  process.exit(1)
}

if (check_only) {
  console.error(`adapter patch not applied: run node .pi/bin/harness/apply-patches.js`)
  process.exit(1)
}

const applied = spawn_sync('patch', ['-p1', '-N', '-d', root, '-i', patch], { stdio: 'inherit' })
if (applied.status !== 0) process.exit(1)

if (!read_file_sync(resolve(root, target), 'utf8').includes(fixed)) {
  console.error('adapter patch did not take effect')
  process.exit(1)
}

console.log('adapter patch applied')
