import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { refresh_bin } from '../../src/halo/box.js'

it('refresh_bin gives an old box exactly the template program files', async t => {
  const root = mkdtempSync(join(tmpdir(), 'box-bin-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const seed = join(root, 'seed')
  const realness = join(root, 'realness')
  mkdirSync(join(seed, '.pi', 'bin', 'lib'), { recursive: true })
  writeFileSync(join(seed, '.pi', 'bin', 'lib', 'page-markdown.js'), 'new')
  mkdirSync(join(realness, '.pi', 'bin'), { recursive: true })
  writeFileSync(join(realness, '.pi', 'bin', 'old.js'), 'old')
  writeFileSync(join(realness, 'AGENTS.md'), 'mine')

  await refresh_bin(seed, realness)

  assert.equal(
    readFileSync(
      join(realness, '.pi', 'bin', 'lib', 'page-markdown.js'),
      'utf8'
    ),
    'new'
  )
  assert.equal(readFileSync(join(realness, 'AGENTS.md'), 'utf8'), 'mine')
  assert.equal(existsSync(join(realness, '.pi', 'bin', 'old.js')), false)
})

it('refresh_bin leaves a box alone when the template has no .pi/bin', async t => {
  const root = mkdtempSync(join(tmpdir(), 'box-bin-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  await refresh_bin(join(root, 'seed'), join(root, 'realness'))
  assert.equal(existsSync(join(root, 'realness')), false)
})
