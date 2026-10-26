import { after, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { disk } from '../../src/can/disk.js'
import { is_poster, pull, stale } from '../../src/control/pull.js'

const base = new URL(
  `../../../../artifacts/realness/pull-test-${randomUUID()}/`,
  import.meta.url
).pathname
after(() => rm(base, { recursive: true, force: true }))

it('pull copies bytes and meta, then skips what is current', async () => {
  const from = disk(`${base}from`)
  const to = disk(`${base}to`)
  await from.put('people/+1/thoughts/a.html', '<p>a</p>', {
    meta: { kind: 'thought' }
  })
  await from.put('halos/x/status.html', 'secret')

  const first = await pull({ from, to, prefixes: ['people/'] })
  assert.deepEqual(first.copied, ['people/+1/thoughts/a.html'])
  const copy = await to.get('people/+1/thoughts/a.html')
  assert.equal(copy.body.toString(), '<p>a</p>')
  assert.deepEqual(copy.meta, { kind: 'thought' })
  assert.equal(await to.get('halos/x/status.html'), null)

  const again = await pull({ from, to, prefixes: ['people/'] })
  assert.deepEqual(again.copied, [])
  assert.equal(again.skipped, 1)
  assert.equal(
    (await from.get('people/+1/thoughts/a.html')).body.toString(),
    '<p>a</p>'
  )
})

it('stale when missing, resized, or updated later', () => {
  const source = { size: 3, updated: '2026-01-02T00:00:00Z' }
  assert.equal(stale(source, undefined), true)
  assert.equal(stale(source, { ...source, size: 4 }), true)
  assert.equal(
    stale(source, { size: 3, updated: '2026-01-01T00:00:00Z' }),
    true
  )
  assert.equal(
    stale(source, { size: 3, updated: '2026-01-03T00:00:00Z' }),
    false
  )
})

it('pull posters takes only posters and overwrites local copies', async () => {
  const from = disk(`${base}posters-from`)
  const to = disk(`${base}posters-to`)
  await from.put('people/+1/posters/1.html', 'production')
  await from.put('people/+1/thoughts/a.html', 'not a poster')
  await to.put('people/+1/posters/1.html', 'local, newer and longer')
  const options = {
    from,
    to,
    prefixes: ['people/'],
    only: is_poster,
    overwrite: true
  }

  const dry = await pull({ ...options, dry_run: true })
  assert.deepEqual(dry.copied, ['people/+1/posters/1.html'])
  assert.equal(
    (await to.get('people/+1/posters/1.html')).body.toString(),
    'local, newer and longer'
  )

  await pull(options)
  assert.equal(
    (await to.get('people/+1/posters/1.html')).body.toString(),
    'production'
  )
  assert.equal(await to.get('people/+1/thoughts/a.html'), null)
})
