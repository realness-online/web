#!/usr/bin/env node
import { spawnSync as spawn_sync } from 'node:child_process'
import { resolve } from 'node:path'

const script = resolve(import.meta.dirname, 'add-alarms.applescript')
const { stdout, stderr, status } = spawn_sync('/usr/bin/osascript', [script], { encoding: 'utf8' })

if (status !== 0) {
  process.stderr.write(stderr)
  process.exit(status ?? 1)
}

process.stdout.write(stdout)
