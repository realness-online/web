import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import {
  actor_code,
  actor_code_files,
  halo_code,
  halo_code_files,
  read_code_stamp,
  same_code,
  shipped_actor_code
} from '../../lib/code-stamp.js'

/** A harness root with an app inside, holding the folders each label reads. */
const harness = t => {
  const root = mkdtempSync(join(tmpdir(), 'code-stamp-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const app = join(root, 'apps/realness')
  const put = (path, text = 'x') => {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  put('apps/realness/lib/release.js', 'halo')
  put('apps/realness/server/halo/guest/realness-read.js', 'guest')
  put('.pi/bin/web/realness-read', 'script')
  return { root, app, put }
}

it('the same code gives the same labels', t => {
  const { root, app } = harness(t)
  assert.equal(halo_code(app), halo_code(app))
  assert.equal(actor_code(root), actor_code(root))
})

it('a halo change moves only the halo label', t => {
  const { root, app, put } = harness(t)
  const halo = halo_code(app)
  const actor = actor_code(root)
  put('apps/realness/server/halo/guest/realness-read.js', 'guest, changed')
  assert.notEqual(halo_code(app), halo)
  assert.equal(actor_code(root), actor)
})

it('an actor script change moves only the actor label', t => {
  const { root, app, put } = harness(t)
  const halo = halo_code(app)
  const actor = actor_code(root)
  put('.pi/bin/web/realness-read', 'script, changed')
  assert.equal(halo_code(app), halo)
  assert.notEqual(actor_code(root), actor)
})

it('code that does not ship leaves both labels alone', t => {
  const { root, app, put } = harness(t)
  const halo = halo_code(app)
  const actor = actor_code(root)
  put('apps/realness/node_modules/thing/index.js')
  put('apps/realness/specs/halo/box.spec.js')
  put('artifacts/realness/shot.png')
  assert.equal(halo_code(app), halo)
  assert.equal(actor_code(root), actor)
})

it('the halo label never reads harness scripts', t => {
  const { root, app } = harness(t)
  assert.ok(halo_code_files(app).includes('server/halo/guest/realness-read.js'))
  assert.ok(!halo_code_files(app).some(file => file.startsWith('.pi/')))
  assert.deepEqual(actor_code_files(root), ['.pi/bin/web/realness-read'])
})

it('a missing label reads as null, never as a match', t => {
  const { root } = harness(t)
  const file = join(root, 'etc/realness-code')
  assert.equal(read_code_stamp(file), null)
  mkdirSync(join(root, 'etc'), { recursive: true })
  writeFileSync(file, `${actor_code(root)}\n`)
  assert.equal(read_code_stamp(file), actor_code(root))
  assert.ok(same_code(read_code_stamp(file), actor_code(root)))
  assert.ok(!same_code(null, null))
  assert.ok(!same_code(actor_code(root), 'other'))
})

it('an actor is current only when both its labels match the halo now', async () => {
  const { stale_code } = await import('../../lib/code-stamp.js')
  const now = { halo: 'h1', image: 'i1' }
  assert.deepEqual(stale_code({ halo: 'h1', image: 'i1' }, now), [])
  assert.deepEqual(stale_code({ halo: 'h0', image: 'i1' }, now), ['halo'])
  assert.deepEqual(stale_code({ halo: 'h1', image: 'i0' }, now), ['image'])
  assert.deepEqual(stale_code(null, now), ['halo', 'image'])
  assert.deepEqual(
    stale_code({ halo: 'h1', image: null }, { halo: 'h1', image: null }),
    ['image']
  )
  assert.deepEqual(stale_code('i1', now), ['halo', 'image'])
  assert.deepEqual(
    stale_code({ halo: 'h1', image: 'i1' }, { halo: 'h1', image: null }),
    ['image']
  )
})

it('a staged halo expects the actor label shipped beside it', t => {
  const { app, put } = harness(t)
  put('apps/realness/.actor-code', 'shipped\n')
  assert.equal(shipped_actor_code(app), 'shipped')
})

it('a halo shipped no actor label expects none', t => {
  const { app } = harness(t)
  assert.equal(shipped_actor_code(app), null)
})
