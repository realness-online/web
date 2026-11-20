import assert from 'node:assert/strict'
import { it } from 'node:test'
import { create_templates } from '../../../tools/publish/renderer/src/templates.js'

const site = {
  name: 'A & B',
  tagline: 'Notes',
  description: 'A small site',
  url: 'https://example.com',
  poster: 'example.svg'
}

const LAYOUTS = ['app', 'article', 'canvas', 'deck', 'print']

/** One note, rendered the way a build renders it. */
const page_of = (layout, data = {}) => {
  const templates = create_templates(site, {})
  const note = { itemid: '/+14155551234/articles/1', ...data }
  const body = templates.article_body(
    note,
    'A note title',
    '<p>Body.</p>',
    '',
    { related: '' }
  )
  return templates.shell('A note title', body, { layout })
}

it('every layout shows the title', () => {
  for (const layout of LAYOUTS)
    assert.match(
      page_of(layout),
      /<h1 itemprop="headline">A note title/,
      layout
    )
})

it('a note with no poster image carries no empty figure', () => {
  for (const layout of LAYOUTS)
    assert.doesNotMatch(page_of(layout), /<figure/, layout)
})

it('the owner phone is shown as a byline, never as a bare link', () => {
  for (const layout of LAYOUTS)
    assert.match(page_of(layout), /<address itemprop="author"/, layout)
})

it('a named author is shown by name', () => {
  const html = page_of('article', { author: 'Scott Fryxell' })
  assert.match(html, /itemprop="name">Scott Fryxell</)
})

it('deck counts its slides', () => {
  const html = page_of('deck')
  assert.match(html, /src="\/layouts\/deck\.js"/)
  assert.match(html, /href="\/layouts\/deck\.css"/)
})
