import assert from 'node:assert/strict'
import { it } from 'node:test'
import { page_text, to_markdown } from '../../lib/page-markdown.js'

const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>"hospital" - Google News</title><link>https://news.google.com/</link>
<item><title>Hospital opens new wing &amp; garden</title><link>https://news.google.com/rss/articles/abc</link><pubDate>Tue, 24 Nov 2026 10:00:00 GMT</pubDate><description>&lt;a href="x"&gt;Hospital opens new wing&lt;/a&gt;</description><source url="https://sfchronicle.com">SF Chronicle</source></item>
<item><title>Patient experience rises</title><link>https://news.google.com/rss/articles/def</link></item>
</channel></rss>`

const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Blog</title><entry><title>First post</title><link href="https://blog.example/1"/><updated>2026-11-01</updated><summary>About the start</summary></entry></feed>`

it('reads every item of an RSS feed', () => {
  const page = to_markdown(rss)
  assert.equal(page.title, '"hospital" - Google News')
  assert.match(
    page.markdown,
    /\[Hospital opens new wing & garden\]\(https:\/\/news\.google\.com\/rss\/articles\/abc\) \| SF Chronicle \| Tue, 24 Nov 2026/
  )
  assert.match(page.markdown, /Patient experience rises/)
})

it('reads an Atom feed with its summaries', () => {
  const page = to_markdown(atom)
  assert.equal(page.title, 'Blog')
  assert.match(page.markdown, /\[First post\]\(https:\/\/blog\.example\/1\) \| 2026-11-01\n {2}About the start/)
})

it('counts feed items in the page an agent reads', () => {
  const text = page_text({ kind: 'html', body: rss }, { url: 'https://news.google.com/rss', source: 'static' })
  assert.doesNotMatch(text, /\| 0 chars/)
  assert.match(text, /Patient experience rises/)
})

it('keeps a JSON reply exact, links and all', () => {
  const body = JSON.stringify({
    posts: [{ body: 'See [our site](https://a.example) ![logo](https://a.example/x.png)\n\n\n\nend' }]
  })
  const text = page_text({ kind: 'json', body }, { url: 'https://a.example/api', source: 'static', max: 100000 })
  assert.deepEqual(JSON.parse(text.split('\n').slice(3).join('\n')), JSON.parse(body))
})

it('still reads plain HTML pages', () => {
  const page = to_markdown(
    '<html><head><title>Hi</title></head><body><h1>Hello</h1><p>Some words here.</p></body></html>'
  )
  assert.match(page.markdown, /Some words here/)
})
