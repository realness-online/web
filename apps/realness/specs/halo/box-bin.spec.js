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
import { refresh_program } from '../../src/halo/box.js'

/** A seed harness holding `files`, and a box harness holding `held`. */
const harnesses = (t, files, held = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'box-bin-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const seed = join(root, 'seed')
  const realness = join(root, 'realness')
  const put = (base, path, text) => {
    mkdirSync(join(base, path, '..'), { recursive: true })
    writeFileSync(join(base, path), text)
  }
  for (const [path, text] of Object.entries(files)) put(seed, path, text)
  for (const [path, text] of Object.entries(held)) put(realness, path, text)
  return { seed, realness, put }
}

it('refresh_program replaces the program folders the image owns', async t => {
  const { seed, realness } = harnesses(
    t,
    {
      '.pi/bin/lib/page-markdown.js': 'new',
      '.pi/skills/scout/SKILL.md': 'new skill',
      '.pi/extensions/a.js': 'new extension',
      'themes/realness.json': 'new theme'
    },
    {
      '.pi/bin/old.js': 'old',
      '.pi/skills/scout/SKILL.md': 'old skill',
      '.pi/extensions/a.js': 'old extension',
      'themes/realness.json': 'old theme',
      'AGENTS.md': 'mine'
    }
  )

  await refresh_program(seed, realness)

  assert.equal(
    readFileSync(join(realness, '.pi/bin/lib/page-markdown.js'), 'utf8'),
    'new'
  )
  assert.equal(
    readFileSync(join(realness, '.pi/skills/scout/SKILL.md'), 'utf8'),
    'new skill'
  )
  assert.equal(
    readFileSync(join(realness, '.pi/extensions/a.js'), 'utf8'),
    'new extension'
  )
  assert.equal(
    readFileSync(join(realness, 'themes/realness.json'), 'utf8'),
    'new theme'
  )
  assert.equal(existsSync(join(realness, '.pi/bin/old.js')), false)
  assert.equal(readFileSync(join(realness, 'AGENTS.md'), 'utf8'), 'mine')
})

it('refresh_program copies packages only when their lock file changed', async t => {
  const { seed, realness } = harnesses(
    t,
    {
      '.pi/runtime/package-lock.json': 'lock v1',
      '.pi/runtime/node_modules/p.js': 'same',
      '.pi/node_modules/p.js': 'old package',
      '.pi/package-lock.json': 'lock v2'
    },
    {
      '.pi/runtime/package-lock.json': 'lock v1',
      '.pi/runtime/node_modules/p.js': 'old',
      '.pi/node_modules/p.js': 'old package',
      '.pi/package-lock.json': 'lock v1'
    }
  )

  await refresh_program(seed, realness)

  assert.equal(
    readFileSync(join(realness, '.pi/runtime/node_modules/p.js'), 'utf8'),
    'old'
  )
  assert.equal(
    readFileSync(join(realness, '.pi/package-lock.json'), 'utf8'),
    'lock v2'
  )
  assert.equal(
    readFileSync(join(realness, '.pi/node_modules/p.js'), 'utf8'),
    'old package'
  )
})

it('refresh_program leaves a box alone when the template has no program code', async t => {
  const { seed, realness } = harnesses(t, {})

  await refresh_program(seed, realness)

  assert.equal(existsSync(realness), false)
})
