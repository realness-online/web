/**
 * b4: a blog poster reaches the app from the vault, by name only.
 */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile as write_file } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, it } from 'node:test'
import { poster_svg } from '#root/src/sync/vault-posters.js'

let dir = ''

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'vault-posters-'))
  await mkdir(join(dir, 'Areas/Blog/posters'), { recursive: true })
  await write_file(join(dir, 'Areas/Blog/posters/p.svg'), '<svg id="p"/>')
  await write_file(join(dir, 'Areas/Blog/secret.md'), 'not a poster')
})

after(() => rm(dir, { recursive: true, force: true }))

it('reads a poster by name', async () => {
  assert.equal(await poster_svg(dir, 'p.svg'), '<svg id="p"/>')
})

it('refuses a name that leaves the poster folder', async () => {
  for (const name of ['../secret.md', '../../x.svg', 'a/b.svg', '', 7, null])
    assert.equal(await poster_svg(dir, name), null)
})

it('refuses a name that is not an SVG', async () => {
  assert.equal(await poster_svg(dir, 'secret.md'), null)
})

it('is null when the poster is not there', async () => {
  assert.equal(await poster_svg(dir, 'missing.svg'), null)
})
