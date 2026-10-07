import { codeToHtml as code_to_html } from 'shiki'

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }
const code_block = /<pre(?: language="([^"]*)")?><code[^>]*>([\s\S]*?)<\/code><\/pre>/g
const card_block = /<pre language="cardlink"><code[^>]*>([\s\S]*?)<\/code><\/pre>/g

const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const unescape_entities = text => text.replace(/&(amp|lt|gt|quot|#39);/g, (_, name) => entities[name])

/**
 * An Obsidian cardlink fence: a pasted link as `key: value` lines, written by
 * the plugin from the page's own metadata. No fetch: the fields are already in
 * the note. Rendered as a link with its title, description, and host.
 */
const cardlink = (code) => {
  const fields = {}
  for (const line of code.replace(/<[^>]*>/g, '').split('\n')) {
    const found = /^\s*([a-z_]+)\s*:\s*(.*)$/i.exec(line)
    if (found) fields[found[1].toLowerCase()] = unescape_entities(found[2]).trim().replace(/^"|"$/g, '')
  }
  if (!/^https?:\/\//.test(fields.url ?? '')) return null
  const host = fields.host || new URL(fields.url).hostname
  const title = fields.title || fields.url
  const description = fields.description ? `<p itemprop="description">${escape(fields.description)}</p>` : ''
  const icon = fields.favicon ? `<img src="${escape(fields.favicon)}" alt="" loading="lazy" width="16" height="16">` : ''
  const image = fields.image ? `<img itemprop="image" src="${escape(fields.image)}" alt="" loading="lazy">` : ''
  // The card is a link: the whole card is the target, so it holds the figure.
  return `<a itemprop="url" href="${escape(fields.url)}"><figure>${image}<figcaption>${icon}<strong itemprop="name">${escape(title)}</strong><span itemprop="provider">${escape(host)}</span>${description}</figcaption></figure></a>`
}

const card_paragraph = /<p>(<a itemprop="url"[\s\S]*?<figure>[\s\S]*?<\/figure><\/a>)<\/p>/g

/** A paragraph holding nothing but a cardlink link is the card itself. */
const unparagraph_card = (html) => {
  return html.replace(card_paragraph, '$1')
}

/**
 * comark hands us the language on the fence; shiki turns it into themed spans.
 * A mermaid fence stays text for scripts/diagrams.js to draw in the browser.
 * Cards are replaced before highlighting, so they never reach shiki.
 */
export const highlight = async (html) => {
  html = unparagraph_card(html.replace(card_block, (block, code) => cardlink(code) ?? block))
  const blocks = [...html.matchAll(code_block)]
  if (!blocks.length) return html
  const rendered = await Promise.all(blocks.map(([, language, code]) =>
    language === 'mermaid' ? `<pre class="mermaid">${code}</pre>` : code_to_html(code.replace(/&(amp|lt|gt|quot|#39);/g, (_, name) => entities[name]), {
      lang: language || 'text',
      themes: { light: 'one-light', dark: 'one-dark-pro' },
      defaultColor: false
    })
  ))
  return blocks.reduce((out, block, i) => out.replace(block[0], () => rendered[i]), html)
}

const lone_image = /<p>(<img [^>]*>)<\/p>/g
const title_attr = / title="([^"]*)"/

/**
 * A paragraph that holds nothing but an image is a plate: pull it out of the
 * prose column and hand the markdown title to a caption.
 */
export const plate = (html) => {
  return html.replace(lone_image, (_, img) => {
    const caption = img.match(title_attr)?.[1]
    return `<figure class="plate">${img.replace(title_attr, '')}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`
  })
}

const external_link = /<a ([^>]*?)href="(https?:\/\/[^"]+)"([^>]*)>([\s\S]*?)<\/a>/g

/**
 * Paper has no hover and no address bar: number every outbound link and collect
 * the addresses into an endnote list the print sheet reveals.
 */
export const footnote = (html) => {
  const seen = new Map()
  const marked = html.replace(external_link, (_, before, href, after, text) => {
    if (!seen.has(href)) seen.set(href, seen.size + 1)
    const n = seen.get(href)
    return `<a ${before}href="${href}"${after}>${text}</a><sup class="note-mark">${n}</sup>`
  })
  if (!seen.size) return { html: marked, notes: '' }
  const items = [...seen.keys()].map(href => `<li>${href}</li>`).join('')
  return { html: marked, notes: `<ol class="notes">${items}</ol>` }
}

export const strip_tags = (html) => {
  return unescape_entities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

