import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import { it } from 'node:test'
import { python_command } from '../../lib/python.js'

const version = command => {
  const result = spawn_sync(command, ['--version'], { encoding: 'utf8' })
  return `${result.stdout}${result.stderr}`.trim()
}

it('the chosen interpreter runs', () => {
  const result = spawn_sync(python_command(), ['-c', 'print(1)'], {
    encoding: 'utf8'
  })
  assert.equal(result.status, 0)
  assert.equal(result.stdout.trim(), '1')
})

it('3.9 is not chosen while 3.11 is available', t => {
  if (spawn_sync('python3.11', ['--version'], { stdio: 'ignore' }).status !== 0)
    return t.skip('no python3.11 on this machine')
  assert.doesNotMatch(version(python_command()), /^Python 3\.9\./)
})