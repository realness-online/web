/**
 * Health checks are polled constantly; logging them buried everything else.
 */
import { after, before, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { disk } from '#root/src/can/disk.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'
import { out_path } from '#root/lib/output.js'

const root = out_path(`health-log-test-${randomUUID()}/`)
const issuer = dev_issuer()
const storage = disk(join(root, 'bucket'))
const lines = []
let server
let url

before(async () => {
  server = sync_service({
    storage,
    rights: rights(storage),
    project: issuer.project,
    certs: issuer.certs,
    log: line => lines.push(line)
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  url = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  server.close()
  await rm(root, { recursive: true, force: true })
})

it('a healthy health check leaves no log line; other requests still do', async () => {
  assert.equal((await fetch(`${url}/health`)).status, 200)
  assert.deepEqual(lines, [])
  await fetch(`${url}/people/+15555550100/x.html`)
  assert.equal(lines.length, 1)
  assert.match(lines[0], /GET \/people\//)
})

it('a halo heartbeat counts as routine only when it is a status.html PUT', async () => {
  const { routine } = await import('#root/src/sync/server.js')
  assert.equal(routine('PUT', 'halos/lima-fc-local/status.html'), true)
  assert.equal(routine('GET', 'halos/lima-fc-local/status.html'), false)
  assert.equal(routine('PUT', 'halos/lima-fc-local/lifecycle.html'), false)
  assert.equal(routine('GET', 'health'), true)
})
