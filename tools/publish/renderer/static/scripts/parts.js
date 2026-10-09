// Parts: fences a page or a chat answer may draw. One source for the
// publish build, published pages, and Realness chat. No imports, so it runs
// in Node, in a published page, and in a Vite bundle as is.

const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const WEB = /^https?:\/\//

/**
 * A cardlink fence's `key: value` lines, as the Obsidian plugin writes them
 * from the page's own metadata, rendered as a link card. No fetch.
 * @param {string} text Raw fence text, unescaped.
 * @param {{images?: boolean}} [options] `images: false` keeps the reader's
 *   address from remote hosts, as chat needs.
 * @returns {string | null} Card HTML, or null when the url is not a web link.
 */
export const card_html = (text, { images = true } = {}) => {
  const fields = {}
  for (const line of text.split('\n')) {
    const found = /^\s*([a-z_]+)\s*:\s*(.*)$/i.exec(line)
    if (found) fields[found[1].toLowerCase()] = found[2].trim().replace(/^"|"$/g, '')
  }
  if (!WEB.test(fields.url ?? '')) return null
  const host = fields.host || new URL(fields.url).hostname
  const title = fields.title || fields.url
  const description = fields.description ? `<p itemprop="description">${escape(fields.description)}</p>` : ''
  const remote = name => images && WEB.test(fields[name] ?? '')
  const icon = remote('favicon') ? `<img src="${escape(fields.favicon)}" alt="" loading="lazy" width="16" height="16">` : ''
  const image = remote('image') ? `<img itemprop="image" src="${escape(fields.image)}" alt="" loading="lazy">` : ''
  // The card is a link: the whole card is the target, so it holds the figure.
  return `<a itemprop="url" href="${escape(fields.url)}"><figure>${image}<figcaption>${icon}<strong itemprop="name">${escape(title)}</strong><span itemprop="provider">${escape(host)}</span>${description}</figcaption></figure></a>`
}

// Mermaid's color parser rejects modern formats such as oklch(), so paint each
// value and read the sRGB pixel back. An unpaintable value samples as black,
// which mermaid accepts.
const to_hex = value => {
  if (!value) return value
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Mermaid colors require a 2D canvas context')
  context.fillStyle = '#000'
  context.fillStyle = value
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Mermaid settings themed from the page's Realness roles. Strict security:
 * labels stay text and click handlers never bind.
 */
export const mermaid_config = () => {
  // mermaid has no theme that follows the OS, so read the page's colors
  const css = getComputedStyle(document.documentElement)
  const color = name => to_hex(css.getPropertyValue(name).trim())
  const surface = color('--surface')
  const text = color('--text')
  const line = color('--accent') || color('--blue')
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: {
      fontFamily: getComputedStyle(document.body).fontFamily,
      background: surface,
      primaryColor: surface,
      primaryTextColor: text,
      primaryBorderColor: line,
      lineColor: line,
      textColor: text,
      nodeBorder: line,
      clusterBkg: surface,
      clusterBorder: line
    },
    // CSS inside the SVG reads Realness roles directly and follows the OS scheme.
    themeCSS: `
      .node rect, .node polygon { fill: var(--surface) !important; stroke: var(--muted-text) !important; }
      .nodeLabel, .edgeLabel, .label { color: var(--text); fill: var(--text); }
      .edgeLabel, .edgeLabel p, .labelBkg { background: var(--surface) !important; }
      .flowchart-link { stroke: var(--muted-text); }
      .marker { fill: var(--muted-text); stroke: var(--muted-text); }
      .cluster rect { fill: none !important; stroke: var(--code-surface) !important; }
      .node.no rect { stroke: var(--emphasis); }
      .node.no .nodeLabel { color: var(--emphasis); }
      .node.out rect { stroke: var(--accent); }
      .node.out .nodeLabel { color: var(--accent); }`,
    flowchart: { curve: 'basis', padding: 12 }
  }
}

/**
 * Draw `pre.mermaid` parts into SVG. The caller supplies mermaid, so a page
 * can load its own copy and a bundle can import one.
 * @param {Element[]} nodes
 * @param {() => Promise<{initialize: Function, run: Function}>} load
 */
export const draw_diagrams = async (nodes, load) => {
  if (!nodes.length) return
  const mermaid = await load()
  mermaid.initialize(mermaid_config())
  await mermaid.run({ nodes })
}
