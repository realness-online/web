import assert from 'node:assert/strict'
import { create_gcs } from '#root/src/can/gcs.js'
import { ActorStore } from '../../src/halo/actors.js'
import { HaloStatus, read_status } from '../../src/halo/status.js'

const bucket = process.env.LOOPS_BUCKET
const token = process.env.LOOPS_ACCESS_TOKEN
if (!bucket || !token) {
  console.error(
    'usage: LOOPS_BUCKET=<bucket> LOOPS_ACCESS_TOKEN=<token> node checks/halo/status.check.js'
  )
  process.exit(2)
}

const store = new ActorStore({
  volume: '/opt/fc/actors/mnt',
  template: '/opt/fc/template.ext4',
  kernel: '/opt/fc/vmlinux-6.1.155',
  firecracker: '/opt/fc/firecracker'
})
const mirror = create_gcs({ bucket, token: async () => token })
const warned = []
const status = new HaloStatus(store, {
  mirror,
  warn: message => warned.push(message)
})

assert.equal(await status.publish(), true, warned.join('; '))
const stored = await mirror.get(`halos/${status.halo}/status.html`)
assert.ok(stored, 'the status page was published')
const read = read_status(stored.body.toString('utf8'))
const { halo } = read
assert.ok(halo, 'the status page has a halo record')
assert.equal(halo.name, status.halo)
assert.equal(read.actors.length, store.list().length)
assert.ok(Number(halo.mem_total) > 0 && Number(halo.volume_size) > 0)
console.log(
  `  ok   halos/${status.halo}/status.html: checked ${halo.checked}, seed ${halo.seed}, ${read.actors.length} actors`
)
