import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { it } from 'node:test'

const source = path => readFile(new URL(path, import.meta.url), 'utf8')

/** The folder a flag defaults to in the halo's own options. */
const default_of = (text, flag) =>
  text.match(
    new RegExp(`\\b${flag}: \\{ type: 'string', default: '([^']+)'`)
  )?.[1]

it('the halo keeps its jars outside the storage a fresh build wipes', async () => {
  const main = await source('../../server/halo/main.js')
  const jars = default_of(main, 'jars')
  assert.ok(jars, 'the halo names a jars folder')
  assert.doesNotMatch(jars, /^\/opt\/fc\/(boxes|actors)/)
  assert.equal(default_of(main, 'volume'), '/opt/fc/actors/mnt')
})

it('a fresh local stack wipes the actor storage alone, never the jars', async () => {
  const stack = await source('../../tools/control/scripts/dev-stack.sh')
  const wipe = stack.match(/rm -rf "(\$[A-Z_]+)"/g) ?? []
  assert.deepEqual(wipe, ['rm -rf "$BOX_VOL"', 'rm -rf "$VOL"'])
  assert.doesNotMatch(stack, /jars/)
})
