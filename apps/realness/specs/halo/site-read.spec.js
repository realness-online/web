import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  address_of,
  cookie_header,
  site_read,
  visible_text
} from '#root/src/halo/site-read.js'

const cookies = [
  { name: '_sso.key', value: 'k' },
  { name: 'x', value: 'y' }
]

/** A fetch answering one page, recording the cookie header it was given. */
const fetch_of =
  (html, seen = [], status = 200) =>
  async (url, options) => {
    seen.push(options.headers.cookie)
    return { ok: status < 400, status, text: async () => html }
  }

it('a page the server renders comes back without a Chrome', async () => {
  const seen = []
  const page = await site_read('https://example.com/', {
    cookies,
    fetcher: fetch_of(`<html>${'x'.repeat(4000)}</html>`, seen)
  })
  assert.equal(page.source, 'static')
  assert.equal(page.status, 200)
  assert.deepEqual(seen, ['_sso.key=k; x=y'])
})

it('a long shell with no words is thin, and renders', async () => {
  const shell = `<html><head><script>${'const a=1;'.repeat(2000)}</script></head><body><div id="app"></div></body></html>`
  const page = await site_read('https://example.com/', {
    cookies,
    fetcher: fetch_of(shell),
    render: async () => ({ status: 200, html: 'x'.repeat(5000) })
  })
  assert.equal(page.source, 'chrome')
})

it('visible text is the document without scripts, styles, or markup', () => {
  assert.equal(
    visible_text(
      '<html><style>p{}</style><script>var x=1</script><body><p>Hello&nbsp;there</p></body></html>'
    ),
    'Hello there'
  )
})

it('a thin page falls through to this box Chrome', async () => {
  let asked = null
  const page = await site_read('https://example.com/', {
    cookies,
    fetcher: fetch_of('<html>loading</html>'),
    render: async url => {
      asked = url
      return { status: 200, html: 'x'.repeat(5000) }
    }
  })
  assert.equal(page.source, 'chrome')
  assert.equal(asked, 'https://example.com/')
})

it('a refused page also falls through to a rendered page', async () => {
  const page = await site_read('https://example.com/', {
    cookies,
    fetcher: fetch_of('', [], 406),
    render: async () => ({ status: 200, html: 'x'.repeat(5000) })
  })
  assert.equal(page.source, 'chrome')
})

it('no saved login skips the fetch and renders', async () => {
  let fetched = false
  await site_read('https://example.com/', {
    fetcher: async () => {
      fetched = true
    },
    render: async () => ({ status: 200, html: 'x'.repeat(5000) })
  })
  assert.equal(fetched, false)
})

it('a thin page with no Chrome to render it fails, and says why', async () => {
  await assert.rejects(
    site_read('https://example.com/', { fetcher: fetch_of('<html></html>') }),
    /no Chrome to render/
  )
})

it('a jar becomes one cookie header, and a lease url a bare address', () => {
  assert.equal(cookie_header(cookies), '_sso.key=k; x=y')
  assert.equal(address_of('http://172.19.3.2:9222'), '172.19.3.2')
})
