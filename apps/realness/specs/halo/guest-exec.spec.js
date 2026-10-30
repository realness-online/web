import assert from 'node:assert/strict'
import {
  readFileSync as read_file_sync,
  readdirSync as readdir_sync
} from 'node:fs'
import { it } from 'node:test'
import { installed_name } from '../../src/halo/box.js'

const guest = new URL('../../server/halo/guest/', import.meta.url)
const box = read_file_sync(
  new URL('../../src/halo/box.js', import.meta.url),
  'utf8'
)
const units = readdir_sync(guest)
  .filter(name => name.endsWith('.service'))
  .map(name => read_file_sync(new URL(name, guest), 'utf8'))

it('every socat EXEC names one program, so socat sees exactly two addresses', () => {
  for (const source of [box, ...units])
    for (const [address] of source.matchAll(/EXEC:\S+(?: \S+)?/g))
      assert.doesNotMatch(address, /EXEC:\S+ \/\S+/, address)
})

it('a program socat or the box starts is an executable script', () => {
  for (const name of [
    'realness-agent.js',
    'realness-pty.js',
    'realness-chat.js',
    'realness-responder.js'
  ])
    assert.match(
      read_file_sync(new URL(name, guest), 'utf8'),
      /^#!\/usr\/bin\/env node\n/,
      name
    )
})

it('guest scripts import only node: builtins and their siblings, since the guest has no package', () => {
  for (const name of readdir_sync(guest).filter(file =>
    /^realness-(?!serve).*\.js$/.test(file)
  ))
    for (const [, specifier] of read_file_sync(
      new URL(name, guest),
      'utf8'
    ).matchAll(/^import [^']*'([^']+)'/gm))
      assert.match(specifier, /^(node:|\.\/)/, `${name} imports ${specifier}`)
})

it('no script waits for a .js name to start, because it is installed without one', () => {
  for (const name of readdir_sync(guest).filter(file => file.endsWith('.js')))
    assert.doesNotMatch(
      read_file_sync(new URL(name, guest), 'utf8'),
      /argv\[1\]\?*\.endsWith\(/,
      name
    )
})

it('box copies land under the names the template installs', () => {
  assert.equal(installed_name('realness-agent.js'), 'realness-agent')
  assert.equal(installed_name('realness-responder.js'), 'realness-responder')
  assert.equal(installed_name('realness-actor-init'), 'realness-actor-init')
  assert.equal(installed_name('realness-door.js'), 'realness-door.js')
})
