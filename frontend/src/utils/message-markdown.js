import { Marked } from 'marked'

const SAFE_LINK = /^(https?:|mailto:)/i

const escape_html = text =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/**
 * Markdown from an actor is untrusted: raw HTML shows as text, and only web
 * and mail links become links. Its own instance, so documentation's
 * extensions never apply here.
 */
const markdown = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html: ({ text }) => escape_html(text),
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
