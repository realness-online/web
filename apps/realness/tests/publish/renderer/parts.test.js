/**
 * The renderer's own parts: the cardlink fence, the Mermaid theme read from
 * the page's Realness roles, and the diagram run.
 *
 * parts.js is a browser script, so the DOM parts get a small canvas and
 * computed-style stand-in rather than a whole browser.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  card_html,
  draw_diagrams,
  mermaid_config
} from '../../../tools/publish/renderer/static/scripts/parts.js'

const fence = fields =>
  Object.entries(fields)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')

/**
 * A canvas that remembers what it was painted, and a computed style that
 * answers the page's role names.
 */
const install_dom = (t, { roles = {}, canvas = true } = {}) => {
  const had = {
    document: 'document' in globalThis,
    getComputedStyle: 'getComputedStyle' in globalThis
  }
  const before = {
    document: globalThis.document,
    getComputedStyle: globalThis.getComputedStyle
  }

  let painted = '#000000'
  const context = { fillRect() {} }
  Object.defineProperty(context, 'fillStyle', {
    get: () => painted,
    set: value => {
      painted = value
    }
  })
  context.getImageData = () => {
    const hex = painted.replace('#', '')
    const full =
      hex.length === 3 ? [...hex].map(c => c.repeat(2)).join('') : hex
    return { data: [0, 2, 4].map(at => parseInt(full.slice(at, at + 2), 16)) }
  }

  globalThis.document = {
    documentElement: {},
    body: {},
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => (canvas ? context : null)
    })
  }
  globalThis.getComputedStyle = element =>
    element === globalThis.document.body
      ? { fontFamily: 'Realness Sans' }
      : { getPropertyValue: name => roles[name] ?? '' }

  t.after(() => {
    if (had.document) globalThis.document = before.document
    else delete globalThis.document
    if (had.getComputedStyle)
      globalThis.getComputedStyle = before.getComputedStyle
    else delete globalThis.getComputedStyle
  })
}

test('a cardlink fence becomes a link card', () => {
  const html = card_html(
    fence({
      url: 'https://realness.online/notes',
      title: 'Notes',
      description: 'A short note',
      host: 'realness.online',
      favicon: 'https://realness.online/favicon.ico',
      image: 'https://realness.online/cover.png'
    })
  )
  assert.match(
    html,
    /^<a itemprop="url" href="https:\/\/realness\.online\/notes">/
  )
  assert.match(html, /<strong itemprop="name">Notes<\/strong>/)
  assert.match(html, /<p itemprop="description">A short note<\/p>/)
  assert.match(html, /<span itemprop="provider">realness\.online<\/span>/)
  assert.match(
    html,
    /<img src="https:\/\/realness\.online\/favicon\.ico" alt="" loading="lazy" width="16" height="16">/
  )
  assert.match(
    html,
    /<img itemprop="image" src="https:\/\/realness\.online\/cover\.png" alt="" loading="lazy">/
  )
})

test('a card falls back to the url for host and title', () => {
  const html = card_html(fence({ url: 'https://example.com/a/b' }))
  assert.match(html, /itemprop="provider">example\.com</)
  assert.match(html, /itemprop="name">https:\/\/example\.com\/a\/b</)
  assert.doesNotMatch(html, /description/)
})

test('a card keeps the reader off remote hosts when images are off', () => {
  const html = card_html(
    fence({
      url: 'https://example.com/a',
      favicon: 'https://example.com/f.ico',
      image: 'https://example.com/i.png'
    }),
    { images: false }
  )
  assert.doesNotMatch(html, /<img/)
})

test('a card only uses a favicon or image that is a web link', () => {
  const html = card_html(
    fence({
      url: 'https://example.com/a',
      favicon: '/local/f.ico',
      image: 'data:image/png;base64,AAAA'
    })
  )
  assert.doesNotMatch(html, /<img/)
})

test('a card escapes whatever the note supplied', () => {
  const html = card_html(
    fence({
      url: 'https://example.com/a?x=1&y=2',
      title: '<script>alert("hi")</script>',
      description: 'a & b < c > d'
    })
  )
  assert.match(html, /&lt;script&gt;alert\(&quot;hi&quot;\)&lt;\/script&gt;/)
  assert.match(html, /a &amp; b &lt; c &gt; d/)
  assert.match(html, /href="https:\/\/example\.com\/a\?x=1&amp;y=2"/)
})

test('a fence that is not a web link is not a card', () => {
  assert.equal(card_html(fence({ url: '/relative/path' })), null)
  assert.equal(card_html(fence({ url: 'ftp://example.com/a' })), null)
  assert.equal(card_html(fence({ title: 'No url here' })), null)
  assert.equal(card_html(''), null)
})

test('a card reads quoted values, ignores prose, and lowercases its keys', () => {
  const html = card_html(
    ['URL: "https://example.com/a"', 'not a field', 'Title: "Quoted"'].join(
      '\n'
    )
  )
  assert.match(html, /href="https:\/\/example\.com\/a"/)
  assert.match(html, /itemprop="name">Quoted</)
  assert.doesNotMatch(html, /not a field/)
})

test('the Mermaid theme comes from the page roles', t => {
  install_dom(t, {
    roles: {
      '--surface': '#ffffff',
      '--text': '#111111',
      '--accent': '#ff8800',
      '--blue': '#0000ff'
    }
  })
  const config = mermaid_config()
  assert.equal(config.securityLevel, 'strict')
  assert.equal(config.startOnLoad, false)
  assert.equal(config.themeVariables.background, '#ffffff')
  assert.equal(config.themeVariables.textColor, '#111111')
  assert.equal(config.themeVariables.lineColor, '#ff8800')
  assert.equal(config.themeVariables.fontFamily, 'Realness Sans')
  assert.match(
    config.themeCSS,
    /\.node\.no rect \{ stroke: var\(--emphasis\); \}/
  )
  assert.deepEqual(config.flowchart, { curve: 'basis', padding: 12 })
})

test('the theme falls back to blue when there is no accent', t => {
  install_dom(t, {
    roles: {
      '--surface': '#fff',
      '--text': '#000',
      '--accent': '',
      '--blue': '#00ff00'
    }
  })
  const config = mermaid_config()
  assert.equal(config.themeVariables.lineColor, '#00ff00')
  assert.equal(config.themeVariables.background, '#ffffff')
})

test('a canvas without a 2D context is refused, not silently uncoloured', t => {
  install_dom(t, { roles: { '--text': '#000' }, canvas: false })
  assert.throws(mermaid_config, /Mermaid colors require a 2D canvas context/)
})

test('drawing no diagrams never loads Mermaid', async () => {
  const asked = []
  await draw_diagrams([], async () => {
    asked.push('loaded')
    return { initialize() {}, run() {} }
  })
  assert.deepEqual(asked, [])
})

test('drawing diagrams configures Mermaid and runs the given nodes', async t => {
  install_dom(t, { roles: { '--text': '#000' } })
  const nodes = [{ id: 'one' }, { id: 'two' }]
  const used = []
  const mermaid = {
    initialize: config => used.push(['initialize', config]),
    run: options => used.push(['run', options])
  }
  await draw_diagrams(nodes, async () => {
    used.push(['load'])
    return mermaid
  })
  assert.deepEqual(
    used.map(entry => entry[0]),
    ['load', 'initialize', 'run']
  )
  assert.equal(used[1][1].securityLevel, 'strict')
  assert.deepEqual(used[2][1].nodes, nodes)
})
