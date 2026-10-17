const escape = text =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
const WEB = /^https?:\/\//

/**
 * A cardlink fence's `key: value` lines, as the Obsidian plugin writes them
 * from the page's own metadata, rendered as a link card. No fetch.
 * @param {string} text Raw fence text, unescaped.
 * @param {{images?: boolean}} [options] `images: false` keeps the reader's
 *   address from remote halos, as chat needs.
 * @returns {string | null} Card HTML, or null when the url is not a web link.
 */
export const card_html = (text, { images = true } = {}) => {
  const fields = {}
  for (const line of text.split('\n')) {
    const found = /^\s*([a-z_]+)\s*:\s*(.*)$/i.exec(line)
    if (found)
      fields[found[1].toLowerCase()] = found[2].trim().replace(/^"|"$/g, '')
  }
  if (!WEB.test(fields.url ?? '')) return null
  const host = fields.host || new URL(fields.url).hostname
  const title = fields.title || fields.url
  const description = fields.description
    ? `<p itemprop="description">${escape(fields.description)}</p>`
    : ''
  const remote = name => images && WEB.test(fields[name] ?? '')
  const icon = remote('favicon')
    ? `<img src="${escape(fields.favicon)}" alt="" loading="lazy" width="16" height="16">`
    : ''
  const image = remote('image')
    ? `<img itemprop="image" src="${escape(fields.image)}" alt="" loading="lazy">`
    : ''
  return `<a itemprop="url" href="${escape(fields.url)}"><figure>${image}<figcaption>${icon}<strong itemprop="name">${escape(title)}</strong><span itemprop="provider">${escape(host)}</span>${description}</figcaption></figure></a>`
}

/**
 * oklch or any CSS color to the `#rrggbb` Mermaid needs: it writes its own
 * `<style>` block from fixed hex, so a `var()` never reaches the arrowheads.
 * @param {string} value
 * @returns {string}
 */
export const to_hex = value => {
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
 * The colors Mermaid cannot read from CSS. Every other style lives in
 * scripts/diagrams.css, so the page keeps one source of truth. Strict
 * security: labels stay text and click handlers never bind.
 */
export const mermaid_config = () => {
  const css = getComputedStyle(document.documentElement)
  const color = name => to_hex(css.getPropertyValue(name).trim())
  const surface = color('--surface')
  const text = color('--text')
  const muted = color('--muted-text')
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: {
      background: surface,
      primaryColor: surface,
      primaryTextColor: text,
      primaryBorderColor: muted,
      lineColor: muted,
      textColor: text,
      nodeBorder: muted,
      clusterBkg: surface,
      clusterBorder: muted
    },
    flowchart: { curve: 'basis', padding: 18 }
  }
}

/**
 * Drop the `classDef` lines a source carries. Mermaid turns them into
 * `!important` rules that no stylesheet can override, and the colors they hold
 * are diagrams.css's to choose. `class` lines stay: they name the status.
 * @param {string} source
 * @returns {string}
 */
export const without_class_defs = source =>
  source
    .split('\n')
    .filter(line => line.trim().slice(0, 8) !== 'classDef')
    .join('\n')

/**
 * Draw `pre.mermaid` parts into SVG. The caller supplies mermaid, so a page
 * can load its own copy and a bundle can import one.
 * @param {Element[]} nodes
 * @param {() => Promise<{initialize: Function, run: Function}>} load
 */
export const draw_diagrams = async (nodes, load) => {
  if (!nodes.length) return
  for (const node of nodes)
    node.textContent = without_class_defs(node.textContent)
  const mermaid = await load()
  mermaid.initialize(mermaid_config())
  await mermaid.run({ nodes })
  for (const node of nodes) plain_shapes(node)
}

/**
 * Drop the inline fills Mermaid writes, so diagrams.css styles every node
 * from the class names in the source.
 * @param {ParentNode} root
 */
export const plain_shapes = root => {
  for (const shape of root.querySelectorAll(
    '.node :is(rect, polygon, path, circle)'
  ))
    shape.removeAttribute('style')
}
