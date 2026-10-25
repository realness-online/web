#!/usr/bin/env node
import { execFileSync as exec_file_sync } from 'node:child_process'
import {
  appendFileSync as append_file_sync,
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

if (process.platform !== 'darwin') {
  process.stdout.write('.DS_Store check skipped (not macOS)\n')
  process.exit(0)
}

const fix = process.argv.includes('--fix')
const ignore = join(homedir(), '.config/git/ignore')
const keys = ['DSDontWriteNetworkStores', 'DSDontWriteUSBStores']
const problems = []

const read_default = key => {
  try {
    return exec_file_sync('defaults', ['read', 'com.apple.desktopservices', key], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    return ''
  }
}

const ignored =
  exists_sync(ignore) &&
  read_file_sync(ignore, 'utf8')
    .split('\n')
    .some(line => line.trim() === '.DS_Store')
if (!ignored) {
  if (fix) {
    mkdir_sync(dirname(ignore), { recursive: true })
    append_file_sync(ignore, '.DS_Store\n')
  } else problems.push(`${ignore} does not list .DS_Store`)
}

for (const key of keys) {
  if (read_default(key) === '1') continue
  if (fix) exec_file_sync('defaults', ['write', 'com.apple.desktopservices', key, '-bool', 'true'])
  else problems.push(`defaults com.apple.desktopservices ${key} is not true`)
}

if (problems.length) {
  process.stderr.write(`${problems.join('\n')}\nRun: node .pi/bin/checks/ds-store.js --fix\n`)
  process.exit(1)
}
process.stdout.write(
  fix ? '.DS_Store settings applied\n' : '.DS_Store is ignored and blocked on network and USB drives\n'
)
