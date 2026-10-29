import assert from 'node:assert/strict'
import { it } from 'node:test'
import { check_command } from '../../src/halo/actors.js'
import { BadRequest } from '../../src/halo/errors.js'

const refused = (argv, cwd = null) =>
  assert.throws(() => check_command(argv, cwd), BadRequest)

it('a program with string arguments passes, empty arguments included', () => {
  check_command(['true'], null)
  check_command(['printf', ''], '/realness')
  check_command(['sh', '-c', 'echo hi'], undefined)
})

it('no program, a non-string, or a NUL never reaches the guest', () => {
  refused([])
  refused([''])
  refused('true')
  refused(null)
  refused(['echo', 5])
  refused(['echo', 'a\0b'])
})

it('cwd is a string or nothing', () => {
  refused(['true'], 5)
  refused(['true'], ['/'])
})
