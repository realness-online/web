import { it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  writeFileSync as write_file_sync,
  readFileSync as read_file_sync,
  rmSync as rm_sync
} from 'node:fs'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { join } from 'node:path'
import { pi_start_argv } from '../../src/halo/pi-start.js'

const scratch = file_url_to_path(
  new URL('../../../../artifacts/realness/pi-start-tests/', import.meta.url)
)

const launch = (t, running, exit_code = 0, starts_on = 1) => {
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
    `test "$1" = start-pi || exit 99\necho x >> "${directory}/starts"\nexit ${exit_code}`
  )
  executable(
    'pgrep',
    `test "$1 $2" = "-x pi" || exit 99\ntest ${running ? 1 : 0} = 1 && test "$(wc -l < "${directory}/starts")" -ge ${starts_on}`
  )
  executable('sleep', 'exit 0')
  const [command, ...args] = pi_start_argv(initializer)
  return spawn_sync(command, args, {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${directory}:/usr/bin:/bin` }
  })
}

it('terminal startup accepts a running Pi process', t => {
  assert.equal(launch(t, true).status, 0)
})

it('a successful initializer without Pi is a startup failure', t => {
  const result = launch(t, false)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Pi did not start in the terminal/)
})

it('terminal startup preserves initializer failure', t => {
  assert.equal(launch(t, true, 7).status, 7)
})

it('a start typed before the terminal is ready is typed again', t => {
  assert.equal(launch(t, true, 0, 2).status, 0)
})

const actor_init = file_url_to_path(
  new URL('../../server/halo/guest/realness-actor-init', import.meta.url)
)

/** Run `realness-actor-init start-pi` with `pgrep` answering `running` for those patterns. */
const start_pi = (t, running) => {
  mkdir_sync(scratch, { recursive: true })
  const directory = mkdtemp_sync(join(scratch, 'opener-'))
  t.after(() => rm_sync(directory, { recursive: true, force: true }))
  const typed = join(directory, 'typed')
  const executable = (name, body) =>
    write_file_sync(join(directory, name), `#!/bin/sh\n${body}\n`, {
      mode: 0o700
    })
  executable(
    'pgrep',
    `case "$*" in ${running.map(flag => `"${flag}"*`).join('|') || '__none__'}) exit 0;; esac\nexit 1`
  )
  executable('pty', `cat >> "${typed}"`)
  write_file_sync(join(directory, 'sock'), '')
  spawn_sync('/bin/sh', [actor_init, 'start-pi'], {
    env: {
      ...process.env,
      PATH: `${directory}:/usr/bin:/bin`,
      REALNESS_PTY: join(directory, 'pty'),
      REALNESS_PTY_SOCK: join(directory, 'sock')
    }
  })
  try {
    return read_file_sync(typed, 'utf8').trim().split('\n').length
  } catch {
    return 0
  }
}

it('types the opener once when no Pi is starting', t => {
  assert.equal(start_pi(t, []), 1)
})

it('types nothing while Pi is still starting as its launcher', t => {
  assert.equal(start_pi(t, ['-f']), 0)
  assert.equal(start_pi(t, ['-x pi']), 0)
})
