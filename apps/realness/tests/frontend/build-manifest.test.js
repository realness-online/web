import assert from 'node:assert/strict'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync as read_file_sync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { out_path } from '#root/lib/output.js'
import { stable_worker_map } from '../../frontend/scripts/build-manifest.js'

const scratch = () => {
  const root = join(out_path('tests'), 'build-manifest')
  mkdirSync(root, { recursive: true })
  return mkdtempSync(join(root, 'case-'))
}

const write_map = (dir, source) => {
  const path = join(dir, 'service.worker.js.map')
  writeFileSync(path, JSON.stringify({ sources: [source], mappings: 'AAAA' }))
  return path
}

test('a workbox temp folder becomes one stable name', t => {
  const dir = scratch()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const path = write_map(
    dir,
    '../../../artifacts/pi/4a66b5b3e3b68696f50a5f5a4e15a3fa/service.worker.js'
  )
  stable_worker_map(dir)
  assert.deepEqual(JSON.parse(read_file_sync(path, 'utf8')).sources, [
    'workbox/service.worker.js'
  ])
})

test('a folder that is not ours is left alone', t => {
  const dir = scratch()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const path = write_map(dir, 'src/service.worker.js')
  stable_worker_map(dir)
  assert.deepEqual(JSON.parse(read_file_sync(path, 'utf8')).sources, [
    'src/service.worker.js'
  ])
})

test('a dist without the map is not an error', t => {
  const dir = scratch()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  stable_worker_map(dir)
  assert.ok(true)
})
