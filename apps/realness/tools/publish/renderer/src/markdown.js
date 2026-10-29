import { codeToHtml as code_to_html } from 'shiki'
import { card_html } from '../static/scripts/parts.js'

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }
const code_block =
  /<pre(?: language="([^"]*)")?><code[^>]*>([\s\S]*?)<\/code><\/pre>/g
const card_block =
  /<pre language="cardlink"><code[^>]*>([\s\S]*?)<\/code><\/pre>/g

const unescape_entities = text =>
  text.replace(/&(amp|lt|gt|quot|#39);/g, (_, name) => entities[name])

/** An Obsidian cardlink fence, as comark escaped it, drawn by the shared part. */
const cardlink = code =>
  card_html(unescape_entities(code.replace(/<[^>]*>/g, '')))

const card_paragraph =
  /<p>(<a itemprop="url"[\s\S]*?<figure>[\s\S]*?<\/figure><\/a>)<\/p>/g

/** A paragraph holding nothing but a cardlink link is the card itself. */
const unparagraph_card = html => html.replace(card_paragraph, '$1')

/**
 * comark hands us the language on the fence; shiki turns it into themed spans.
 * A mermaid fence stays text for scripts/diagrams.js to draw in the browser.
 * Cards are replaced before highlighting, so they never reach shiki.
 */
export const highlight = async html => {
  html = unparagraph_card(
    html.replace(card_block, (block, code) => cardlink(code) ?? block)
  )
  const blocks = [...html.matchAll(code_block)]
  if (!blocks.length) return html
  const rendered = await Promise.all(
    blocks.map(([, language, code]) =>
      language === 'mermaid'
        ? `<pre class="mermaid">${code}</pre>`
        : code_to_html(
            code.replace(
              /&(amp|lt|gt|quot|#39);/g,
              (_, name) => entities[name]
            ),
            {
              lang: language || 'text',
              themes: { light: 'one-light', dark: 'one-dark-pro' },
              defaultColor: false
            }
          )
    )
  )
  return blocks.reduce(
    (out, block, i) => out.replace(block[0], () => rendered[i]),
    html
  )
}

const lone_image = /<p>(<img [^>]*>)<\/p>/g
const title_attr = / title="([^"]*)"/

/**
 * A paragraph that holds nothing but an image is a plate: pull it out of the
 * prose column and hand the markdown title to a caption.
 */
export const plate = html =>
  html.replace(lone_image, (_, img) => {
    const caption = img.match(title_attr)?.[1]
    return `<figure class="plate">${img.replace(title_attr, '')}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`
  })

const external_link =
  /<a ([^>]*?)href="(https?:\/\/[^"]+)"([^>]*)>([\s\S]*?)<\/a>/g

/**
 * Paper has no hover and no address bar: number every outbound link and collect
 * the addresses into an endnote list the print sheet reveals.
 */
export const footnote = html => {
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

export const strip_tags = html =>
  unescape_entities(
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
