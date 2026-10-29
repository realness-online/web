import { after, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { disk } from '#root/src/can/disk.js'
import { store_of } from '#root/src/can/store.js'
import { named, placed } from '#root/src/can/layout.js'
import { can } from '#root/src/can/can.js'
import { out_path } from '#root/lib/output.js'

const dir = out_path(`layout-${randomUUID()}`)
const store = store_of(disk(dir))
after(() => rm(dir, { recursive: true, force: true }))

it('st1, st2: server keys sit under server/, personal rows under the person', () => {
  assert.equal(placed('admins.html'), 'server/admins.html')
  assert.equal(placed('halos/h/status.html'), 'server/halos/h/status.html')
  assert.equal(
    placed('usage/+15555550100/d/a.html'),
    'people/+15555550100/usage/d/a.html'
  )
  assert.equal(
    placed('billing/+15555550100/plan.html'),
    'people/+15555550100/billing/plan.html'
  )
  assert.equal(
    placed('people/+15555550100/posters/1.html'),
    'people/+15555550100/posters/1.html'
  )
  assert.throws(() => placed('people/+15555550100/usage/x'), {
    code: 'reserved'
  })
  assert.throws(() => placed('server/admins.html'), { code: 'reserved' })
  for (const key of [
    'admins.html',
    'usage/+15555550100/d/a.html',
    'people/+1555/x'
  ])
    assert.equal(named(placed(key)), key)
})

it('the store top holds people and server; listings keep their keys', async () => {
  await store.put('admins.html', 'a')
  await store.put('halos/h/status.html', 'up')
  await store.put('usage/+15555550100/d/a.html', 'row')
  await store.put('people/+15555550100/posters/1.html', 'p')
  assert.deepEqual(
    (await readdir(dir)).filter(n => !n.startsWith('.')).sort(),
    ['people', 'server']
  )
  assert.deepEqual((await store.list('usage/')).folders, ['+15555550100'])
  assert.deepEqual((await store.list('usage/+15555550100/d/')).files, [
    'a.html'
  ])
  assert.deepEqual((await store.list('people/+15555550100/')).folders, [
    'posters'
  ])
  assert.deepEqual(Object.keys(await store.walk('people/+15555550100/')), [
    'posters/1.html'
  ])
  assert.equal((await store.get('admins.html')).body.toString(), 'a')
})

it('nobody reaches personal rows through the person folder', () => {
  const me = { phone: '+15555550100' }
  assert.equal(can(me, 'write', 'people/+15555550100/usage/d/a.html'), false)
  assert.equal(can(me, 'get', 'people/+15555550100/billing/plan.html'), false)
  assert.equal(can(me, 'write', 'people/+15555550100/posters/1.html'), true)
})
