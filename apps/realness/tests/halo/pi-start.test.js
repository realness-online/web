import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  writeFileSync as write_file_sync,
  rmSync as rm_sync
} from 'node:fs'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { join } from 'node:path'
import { pi_start_argv } from '../../src/halo/pi-start.js'

const scratch = file_url_to_path(
  new URL('../../../../artifacts/realness/pi-start-tests/', import.meta.url)
)

const launch = (t, running, exit_code = 0) => {
  mkdir_sync(scratch, { recursive: true })
  const directory = mkdtemp_sync(join(scratch, 'launch-'))
  t.after(() => rm_sync(directory, { recursive: true, force: true }))
  const executable = (name, body) => {
    const path = join(directory, name)
    write_file_sync(path, `#!/bin/sh\n${body}\n`, { mode: 0o700 })
    return path
  }
  const initializer = executable(
    'init',
    `test "$1" = start-pi || exit 99\nexit ${exit_code}`
  )
  executable(
    'pgrep',
    `test "$1 $2" = "-x pi" || exit 99\nexit ${running ? 0 : 1}`
  )
  executable('sleep', 'exit 0')
  const [command, ...args] = pi_start_argv(initializer)
  return spawn_sync(command, args, {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${directory}:/usr/bin:/bin` }
  })
}

test('terminal startup accepts a running Pi process', t => {
  assert.equal(launch(t, true).status, 0)
})

test('a successful initializer without Pi is a startup failure', t => {
  const result = launch(t, false)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Pi did not start in the terminal/)
})

test('terminal startup preserves initializer failure', t => {
  assert.equal(launch(t, true, 7).status, 7)
})
