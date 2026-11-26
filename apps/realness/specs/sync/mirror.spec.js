import { after, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, rm, writeFile as write_file } from 'node:fs/promises'
import { randomUUID as random_uuid } from 'node:crypto'
import { copy_on, mirror, production_copy } from '#root/src/sync/mirror.js'
import { disk } from '#root/src/can/disk.js'
import { item_html } from '#root/lib/items.js'
import { out_path } from '#root/lib/output.js'

const root = out_path(`mirror-${random_uuid()}`)
after(() => rm(root, { recursive: true, force: true }))

it('m1: the switches page turns the copy on, and anything else is off', () => {
  assert.equal(copy_on(item_html('switches', { production_copy: 'on' })), true)
  assert.equal(
    copy_on(item_html('switches', { production_copy: 'off' })),
    false
  )
  assert.equal(copy_on(null), false)
})

it('m1: local ends with exactly the production files, one way', async () => {
  const production = disk(`${root}/production`)
  const local = disk(`${root}/local`)
  await production.put('people/+15555550100/vault/a.md.gz', 'a')
  await production.put('people/+15555550100/vault/b.md.gz', 'new b', {
    meta: { created: '2026-01-01' }
  })
  await production.put('orgs/+sms/data/c.html.gz', 'c')
  await local.put('people/+15555550100/vault/b.md.gz', 'old b')
  await local.put('people/+15555550100/vault/only-local.md.gz', 'x')
  await local.put('people/.DS_Store', 'finder')

  const dry = await mirror(production, local)
  assert.equal(dry.copies.length, 3)
  assert.deepEqual(dry.removes, ['people/+15555550100/vault/only-local.md.gz'])
  assert.equal(await local.get('orgs/+sms/data/c.html.gz'), null)

  const run = await mirror(production, local, { write: true })
  assert.equal(run.copied, 3)
  assert.equal(run.removed, 1)
  const { 'people/.DS_Store': finder, ...held } = await local.walk('')
  assert.ok(finder)
  assert.deepEqual(held, await production.walk(''))
  const b = await local.get('people/+15555550100/vault/b.md.gz')
  assert.equal(b.body.toString(), 'new b')
  assert.equal(b.meta.created, '2026-01-01')
  assert.equal(
    await production.get('people/+15555550100/vault/only-local.md.gz'),
    null
  )

  const idle = await mirror(production, local, { write: true })
  assert.equal(idle.copied + idle.removed, 0)
})

it('m1: off never calls production; on copies it', async () => {
  const page = `${root}/Switches.html`
  const production = disk(`${root}/start-production`)
  const local = disk(`${root}/start-local`)
  await production.put('orgs/+sms/data/d.html.gz', 'd')
  await mkdir(root, { recursive: true })
  const from = () => {
    called++
    return production
  }
  let called = 0

  await write_file(page, item_html('switches', { production_copy: 'off' }))
  assert.equal(
    await production_copy({ page, to: local, from, write: true }),
    null
  )
  assert.equal(called, 0)

  await write_file(page, item_html('switches', { production_copy: 'on' }))
  const run = await production_copy({ page, to: local, from, write: true })
  assert.equal(run.copied, 1)
  assert.equal(
    (await local.get('orgs/+sms/data/d.html.gz')).body.toString(),
    'd'
  )
})
