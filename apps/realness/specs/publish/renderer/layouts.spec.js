import assert from 'node:assert/strict'
import { it } from 'node:test'
import { create_templates } from '#root/tools/publish/renderer/src/templates.js'

const site = {
  name: 'A & B',
  tagline: 'Notes',
  description: 'A small site',
  url: 'https://example.com',
  poster: 'example.svg'
}

it('a note with no layout gets the site chrome', () => {
  const { shell } = create_templates(site, {})
  const html = shell('Title', '<p>Body</p>', { url: '/blog/note' })
  assert.match(html, /\/partials\/header\.fragment/)
  assert.match(html, /\/scripts\/diagrams\.js/)
})

it('canvas keeps the palette and drops the site chrome', () => {
  const { shell } = create_templates(site, {})
  const html = shell('Title', '<p>Body</p>', {
    url: '/blog/note',
    layout: 'canvas'
  })
  assert.doesNotMatch(html, /\/partials\//)
  assert.doesNotMatch(html, /\/scripts\/diagrams\.js/)
  assert.match(html, /href="\/palette\.css"/)
  assert.match(html, /<p>Body<\/p>/)
})

it('article adds one readable column', () => {
  const { shell } = create_templates(site, {})
  const html = shell('Title', '<p>Body</p>', {
    url: '/blog/note',
    layout: 'article'
  })
  assert.match(html, /href="\/layouts\/article\.css"/)
  assert.doesNotMatch(html, /\/partials\//)
})

it('canvas sets its own frame, with no column of ours', () => {
  const { shell } = create_templates(site, {})
  const html = shell('Title', '<p>Body</p>', { layout: 'canvas' })
  assert.doesNotMatch(html, /\/layouts\/article\.css/)
})

it('deck links its slides and the keys that move them', () => {
  const { shell } = create_templates(site, {})
  const html = shell('Title', '<p>Slide</p>', {
    url: '/blog/talk',
    layout: 'deck'
  })
  assert.match(html, /href="\/layouts\/deck\.css"/)
  assert.match(html, /src="\/layouts\/deck\.js"/)
  assert.doesNotMatch(html, /\/partials\//)
})

it('print sets a page and drops the site chrome', () => {
  const { shell } = create_templates(site, {})
  const html = shell('Title', '<p>Handout</p>', {
    url: '/blog/handout',
    layout: 'print'
  })
  assert.match(html, /href="\/layouts\/print\.css"/)
  assert.doesNotMatch(html, /\/layouts\/deck\.js/)
  assert.doesNotMatch(html, /\/partials\//)
})

it('an unknown layout stops the build', () => {
  const { shell } = create_templates(site, {})
  assert.throws(
    () => shell('Title', '<p>Body</p>', { layout: 'kanban' }),
    /unsupported layout: kanban/
  )
})
