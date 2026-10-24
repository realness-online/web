/**
 * sy10: a lookup by version reads one small piece, so its time stays flat as
 * a person's files grow. Pieces are written as 100k files would leave them.
 */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, it } from 'node:test'
import { disk } from '#root/src/can/disk.js'
import { index_scope, piece_of } from '#root/src/can/hash-index.js'

const roots = []
after(() =>
  Promise.all(roots.map(root => rm(root, { recursive: true, force: true })))
)

const version = () => randomBytes(16).toString('base64url').slice(0, 22)

/** A store whose index already holds `count` files for people/+1/. */
const indexed = async count => {
  const root = await mkdtemp(join(tmpdir(), 'hash-index-'))
  roots.push(root)
  const pieces = new Map()
  const versions = []
  for (let n = 0; n < count; n++) {
    const v = version()
    versions.push(v)
    const piece = piece_of('people/+1/', v)
    const entries = pieces.get(piece) ?? {}
    entries[v] = [`people/+1/vault/${n}.md`]
    pieces.set(piece, entries)
  }
  await Promise.all(
    [...pieces].map(async ([piece, entries]) => {
      const path = join(root, '.index', piece)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, JSON.stringify(entries))
    })
  )
  return { store: disk(root), versions }
}

/** Median lookup time in milliseconds over `rounds` known versions. */
const median_ms = async ({ store, versions }, rounds = 400) => {
  const times = []
  for (let n = 0; n < rounds; n++) {
    const v = versions[(n * 7919) % versions.length]
    const started = process.hrtime.bigint()
    // eslint-disable-next-line no-await-in-loop -- one lookup at a time, timed
    const found = await store.find('people/+1/', v)
    times.push(Number(process.hrtime.bigint() - started) / 1e6)
    assert.equal(found.length, 1)
  }
  return times.sort((a, b) => a - b)[Math.floor(times.length / 2)]
}

it('only a person scope is indexed', () => {
  assert.equal(index_scope('people/+1/vault/a.md'), 'people/+1/')
  assert.equal(index_scope('people/+1'), null)
  assert.equal(index_scope('halos/h/status.html'), null)
})

it('a lookup stays under 1 ms on disk and flat from 1k to 100k files', async () => {
  const small = await median_ms(await indexed(1_000))
  const large = await median_ms(await indexed(100_000))
  assert.ok(large < 1, `100k files: ${large.toFixed(3)} ms`)
  assert.ok(
    large < small * 3 + 0.1,
    `1k ${small.toFixed(3)} ms, 100k ${large.toFixed(3)} ms`
  )
})
