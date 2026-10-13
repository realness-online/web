import { Marked } from 'marked'

const SAFE_LINK = /^(https?:|mailto:)/i

/** Fences chat may show as parts; the publish renderer draws the same ones. */
export const PARTS = ['mermaid', 'cardlink']

/** A fence that has its closing line; a streaming reply may not yet. */
const CLOSED = /\n[ \t]*(`{3,}|~{3,})[ \t]*\n?$/

const escape_html = text =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/**
 * Markdown from an actor is untrusted: raw HTML shows as text, and only web
 * and mail links become links. An allowed fence becomes an inert part, its
 * text still escaped, for a later step to draw; a fence still streaming is
 * marked busy. Its own instance, so documentation's extensions never apply
 * here.
 */
const markdown = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html: ({ text }) => escape_html(text),
    code: ({ text, lang, raw }) => {
      const part = (lang ?? '').trim().split(/\s/)[0].toLowerCase()
      if (!PARTS.includes(part)) return false
      const busy = CLOSED.test(raw) ? '' : ' aria-busy="true"'
      return `<pre class="${part}"${busy}>${escape_html(text)}</pre>\n`
    },
    link({ href, tokens }) {
      const text = this.parser.parseInline(tokens)
      if (!SAFE_LINK.test(href)) return text
      return `<a href="${escape_html(href)}" rel="noopener noreferrer">${text}</a>`
    },
    image: ({ href, text }) =>
      SAFE_LINK.test(href)
        ? `<a href="${escape_html(href)}" rel="noopener noreferrer">${escape_html(text || href)}</a>`
        : escape_html(text)
  }
})

/** A message's markdown as HTML that is safe to place in the page. */
export const message_html = text => markdown.parse(text ?? '')
