import assert from 'node:assert/strict'
import { readFileSync as read_file_sync } from 'node:fs'
import { it } from 'node:test'

const script = read_file_sync(
  new URL('../../tools/control/scripts/dev-stack.sh', import.meta.url),
  'utf8'
)
const [box, firecracker] = script
  .slice(
    script.indexOf('if [ "$RUNTIME" = box ]; then'),
    script.indexOf('ACTOR_HOST_PORTS=')
  )
  .split('\nelse\n')

it('the box runtime makes no XFS actors volume', () => {
  assert.doesNotMatch(box, /mkfs\.xfs|truncate|mount/)
  assert.match(firecracker, /mkfs\.xfs/)
})

it('a fresh start wipes the storage of the runtime that serves', () => {
  assert.match(box, /rm -rf "\$BOX_VOL"/)
  assert.match(firecracker, /rm -rf "\$VOL"/)
})
