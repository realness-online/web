import assert from 'node:assert/strict'
import { test } from 'node:test'
import { create_templates } from '../src/templates.js'

const site = { name: 'A & B', tagline: 'Notes', description: 'A "quoted" <plan>', url: 'https://example.com', poster: 'example.svg' }

test('metadata remains text when it contains quotes and HTML', () => {
  const { shell } = create_templates(site, {})
  const html = shell('<script>alert(1)</script>', '<p>Trusted rendered body</p>', { url: '/blog/note', og_image_path: '/og/example.jpg' })
  assert.match(html, /content="A &quot;quoted&quot; &lt;plan&gt;"/)
  assert.match(html, /<title>&lt;script&gt;alert\(1\)&lt;\/script&gt;.*A &amp; B<\/title>/)
  assert.match(html, /<p>Trusted rendered body<\/p>/)
  assert.doesNotMatch(html, /<script>alert/)
})

test('poster labels and attributes cannot insert new HTML attributes', () => {
  const { poster } = create_templates({ ...site, back_label: 'Back "home"' }, {})
  const html = poster({ img: 'portrait" onerror="alert(1).svg', date: '2026-10-05' }, 'Title <img src=x>', 'h1', '/blog/" onclick="alert(1)', { close_href: '/' })
  assert.match(html, /Title &lt;img src=x&gt;/)
  assert.match(html, /href="\/blog\/&quot; onclick=&quot;alert\(1\)"/)
  assert.match(html, /aria-label="Back &quot;home&quot;"/)
  assert.doesNotMatch(html, /" onerror="/)
})
