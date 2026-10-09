import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { as_author, as_created_at, as_type, is_itemid, mint, types } from '../src/itemid.js'

const scott = '/+16282281824'

test('h2: plans, articles, diagrams, sources, and pages are items', () => {
  for (const type of ['plans', 'articles', 'diagrams', 'sources', 'pages']) {
    const id = mint(scott, type, 1791571682897)
    assert.equal(is_itemid(id), true)
    assert.equal(as_type(id), type)
    assert.equal(as_author(id), scott)
    assert.equal(as_created_at(id), 1791571682897)
  }
})

test("h2: Realness's posters and thoughts in the vault stay valid", () => {
  assert.equal(is_itemid('/+16282281824/posters/1772229663708'), true)
  assert.equal(is_itemid('/+16282281824/thoughts/1779671690384'), true)
})

test('h2: an unknown type, a missing time, or a missing person is refused', () => {
  assert.equal(is_itemid('/+16282281824/recipes/1791571682897'), false)
  assert.equal(is_itemid('/+16282281824/plans'), false)
  assert.equal(is_itemid('/plans/1791571682897'), false)
  assert.throws(() => mint(scott, 'recipes', 1))
})

test('h2: the rules come from the shared package, not a copy', () => {
  const source = readFileSync(new URL('../src/itemid.js', import.meta.url), 'utf8')
  assert.match(source, /from '#root\/frontend\/packages\/itemid\/src\/index\.js'/)
  assert.doesNotMatch(source, /split\('\/'\)/)
  assert.ok(types.includes('posters') && types.includes('pages'))
})
