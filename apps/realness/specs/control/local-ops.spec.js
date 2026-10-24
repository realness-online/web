import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'
import { LOCAL_SOURCES } from '#root/src/control/overview.js'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

/** l10: local status asks only the Mac's sync. */
it('local status reads halos, loops, and spend, never cloud logs or bills', () => {
  assert.deepEqual(LOCAL_SOURCES, ['halos', 'quiet', 'loops', 'spend'])
})

it('the local watch passes no cloud sources', () => {
  assert.match(
    read('../../src/command/command.js'),
    /cloud: where\.local\s*\?\s*null/
  )
})

/** l7: the Lima halo's intent goes to local sync under its host name, with a halo pass. */
it('local halo intents use the Lima host name and a halo pass', () => {
  const webspace = read('../../tools/control/bin/webspace.js')
  assert.match(webspace, /const halo = `lima-\$\{config\.vm\}`/)
  assert.match(webspace, /sync_records\(\{/)
})
