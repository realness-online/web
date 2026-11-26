import { parse_html, Readability, TurndownService } from './harness-dependencies.js'

const OVERLAY = /cookie|consent|gdpr|onetrust|modal|overlay|popup|signup|sign-up|newsletter|paywall|login-wall/i

const strip_overlays = document => {
  for (const el of document.querySelectorAll('[role=dialog], [aria-modal=true], dialog, [class], [id]')) {
    if (el === document.body || el === document.documentElement) continue
    const label = `${el.getAttribute('class') ?? ''} ${el.id ?? ''}`
    const overlay = el.matches('[role=dialog], [aria-modal=true], dialog') || OVERLAY.test(label)
    if (overlay && (el.textContent ?? '').length < 3000) el.remove()
  }
}

const tag_text = (xml, tag) =>
  (xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))?.[1] ?? '')
    .replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** An RSS or Atom feed as a markdown list, one entry per item. */
export const feed_markdown = xml => {
  const entries = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? []
  const markdown = entries
    .map(entry => {
      const link = tag_text(entry, 'link') || (entry.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '')
      const date = tag_text(entry, 'pubDate') || tag_text(entry, 'updated')
      const source = tag_text(entry, 'source')
      const summary = tag_text(entry, 'description') || tag_text(entry, 'summary')
      const line = [`- [${tag_text(entry, 'title')}](${link})`, source, date].filter(Boolean).join(' | ')
      return summary && !tag_text(entry, 'title').startsWith(summary.slice(0, 40)) ? `${line}\n  ${summary}` : line
    })
    .join('\n\n')
  return { title: tag_text(xml.replace(/<(item|entry)[\s>][\s\S]*/i, ''), 'title'), markdown }
}

const is_feed = body => /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<(rss|feed|rdf:RDF)[\s>]/i.test(body)

/** @param {string} html */
export const to_markdown = html => {
  if (is_feed(html)) return feed_markdown(html)
  const { document } = parse_html(html)
  strip_overlays(document)
  const article = new Readability(document).parse()
  const page = parse_html(html).document
  strip_overlays(page)
  const page_len = page.body?.textContent?.length ?? 0
  const use_article = article && article.textContent.length > page_len * 0.2
  const body = use_article ? article.content : (page.body?.innerHTML ?? '')
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
  td.remove(['script', 'style', 'noscript', 'iframe', 'svg', 'form', 'img', 'figure', 'sup'])
  td.addRule('no-images', { filter: 'img', replacement: () => '' })
  const markdown = td
    .turndown(body)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { title: article?.title ?? document.title ?? '', markdown }
}

/**
 * @param {string} markdown
 * @param {{ links?: boolean }} [options]
 */
export const present = (markdown, { links = false } = {}) => {
  let md = markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  if (!links) md = md.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  return md.replace(/\n{3,}/g, '\n\n').trim()
}

/** Paragraphs that match the word, with the headings above them. */
export const filter = (md, grep) => {
  if (!grep) return md
  const re = new RegExp(grep, 'i')
  return md
    .split(/\n\n+/)
    .filter(p => /^#/.test(p) || re.test(p))
    .filter((p, i, all) => !/^#/.test(p) || (all[i + 1] && !/^#/.test(all[i + 1])))
    .join('\n\n')
}

/**
 * A read reply as the page an agent reads: title, source line, markdown.
 * @param {{ kind: string, body: string, title?: string }} reply
 * @param {{ url: string, source: string, max?: number, grep?: string | null, links?: boolean }} options
 */
export const page_text = (reply, { url, source, max = 8000, grep = null, links = false }) => {
  const page = reply.kind === 'html' ? to_markdown(reply.body) : { title: reply.title ?? '', markdown: reply.body }
  const full = reply.kind === 'json' ? page.markdown : present(page.markdown, { links })
  let md = filter(full, grep)
  const cut = md.length > max
  if (cut) md = md.slice(0, max)
  const title = page.title || reply.title || ''
  return `# ${title}\n<!-- ${url} | ${source} | ${full.length} chars${cut ? `, cut to ${max}` : ''} -->\n\n${md}`
}
