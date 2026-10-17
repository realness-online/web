/**
 * The renderer's own parts: the cardlink fence, the Pele theme read from the
 * page's Realness roles, the diagram run, and chat's Mermaid theme.
 *
 * parts.js is a browser script, so the DOM parts get a small canvas and
 * computed-style stand-in rather than a whole browser.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  card_html,
  draw_diagrams,
  match_theme,
  mermaid_config,
  plain_shapes,
  without_class_defs
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

test('a card falls back to the url for halo and title', () => {
  const html = card_html(fence({ url: 'https://example.com/a/b' }))
  assert.match(html, /itemprop="provider">example\.com</)
  assert.match(html, /itemprop="name">https:\/\/example\.com\/a\/b</)
  assert.doesNotMatch(html, /description/)
})

test('a card keeps the reader off remote halos when images are off', () => {
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

test('the Mermaid theme takes the colors Mermaid cannot read from CSS', t => {
  install_dom(t, {
    roles: {
      '--surface': '#ffffff',
      '--text': '#111111',
      '--muted-text': '#888888'
    }
  })
  const config = mermaid_config()
  assert.equal(config.securityLevel, 'strict')
  assert.equal(config.startOnLoad, false)
  assert.equal(config.themeVariables.background, '#ffffff')
  assert.equal(config.themeVariables.textColor, '#111111')
  assert.equal(config.themeVariables.lineColor, '#888888')
  assert.deepEqual(config.flowchart, { curve: 'basis', padding: 18 })
})

test('styles stay out of the Mermaid config, where CSS cannot retune them', t => {
  install_dom(t, { roles: { '--surface': '#fff', '--text': '#000' } })
  assert.equal('themeCSS' in mermaid_config(), false)
})

test('a canvas without a 2D context is refused, not silently uncoloured', t => {
  install_dom(t, { roles: { '--text': '#000' }, canvas: false })
  assert.throws(mermaid_config, /Mermaid colors require a 2D canvas context/)
})

/** A pre.mermaid stand-in that records the style Pele would inherit. */
const diagram = text => {
  const style = new Map()
  return {
    textContent: text,
    cleared: false,
    style: { setProperty: (name, value) => style.set(name, value) },
    replaceChildren() {
      this.cleared = true
    },
    styles: style
  }
}

test('drawing no diagrams never loads Pele', async () => {
  const asked = []
  await draw_diagrams([], async () => {
    asked.push('loaded')
    return { mount() {} }
  })
  assert.deepEqual(asked, [])
})

test('drawing mounts each diagram with its zoom buttons off', async t => {
  install_dom(t, { roles: { '--text': '#000' } })
  const nodes = [diagram('flowchart LR\n  a --> b'), diagram('flowchart TD')]
  const mounted = []
  await draw_diagrams(nodes, async () => ({
    mount: (node, source, options) => mounted.push([node, source, options])
  }))
  assert.deepEqual(
    mounted.map(([node, source, options]) => [node, source, options]),
    [
      [nodes[0], 'flowchart LR\n  a --> b', { zoom: false }],
      [nodes[1], 'flowchart TD', { zoom: false }]
    ]
  )
  assert.ok(nodes.every(node => node.cleared))
})

test('a diagram takes its colors from Realness roles and the page font', t => {
  install_dom(t, {
    roles: {
      '--surface': 'oklch(0.29 0.01 107)',
      '--text': 'oklch(0.89 0.01 107)',
      '--muted-text': 'gray',
      '--accent': 'teal',
      '--emphasis': 'red'
    }
  })
  const node = diagram('')
  match_theme(node)
  assert.equal(node.styles.get('--pele-bg'), 'oklch(0.29 0.01 107)')
  assert.equal(node.styles.get('--pele-fg'), 'oklch(0.89 0.01 107)')
  assert.equal(node.styles.get('--pele-line'), 'gray')
  assert.equal(node.styles.get('--pele-accent'), 'teal')
  assert.equal(node.styles.get('--pele-error'), 'red')
  assert.equal(node.styles.get('--pele-font'), 'Realness Sans')
})

test('the theme is set before Pele measures the diagram', async t => {
  install_dom(t, { roles: { '--text': '#000' } })
  const node = diagram('flowchart LR')
  let font = null
  await draw_diagrams([node], async () => ({
    mount: target => {
      font = target.styles.get('--pele-font')
    }
  }))
  assert.equal(font, 'Realness Sans')
})

test('a source keeps its class names and loses its inline colors', () => {
  const source = [
    'flowchart LR',
    '  a["a1 one"] --> G{{"GATE 1"}}',
    '  classDef gate fill:#7e531c,stroke:#dfad6d,color:#e1be89;',
    '  classDef done fill:none,stroke:#525252;',
    '  class G gate'
  ].join('\n')
  const out = without_class_defs(source)
  assert.doesNotMatch(out, /classDef|7e531c|525252/)
  assert.match(out, /class G gate/)
  assert.match(out, /flowchart LR/)
})

test('drawing strips classDefs before Pele sees the source', async t => {
  install_dom(t, { roles: { '--text': '#000' } })
  const node = diagram(
    'flowchart LR\n  a["a1 x"]\n  classDef done fill:#525252;'
  )
  let drawn = ''
  await draw_diagrams([node], async () => ({
    mount: (_, source) => {
      drawn = source
    }
  }))
  assert.doesNotMatch(drawn, /classDef/)
  assert.match(drawn, /a1 x/)
})

test('a drawn node drops the inline fills so the stylesheet can style it', () => {
  const shape = {
    style: 'fill:#7e531c',
    removeAttribute: name => name === 'style' && (shape.style = undefined)
  }
  const node = { querySelectorAll: () => [shape] }
  plain_shapes(node)
  assert.equal(shape.style, undefined)
})
