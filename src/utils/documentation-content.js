import documentation_md from '@/content/documentation.md?raw'
import { marked } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import DOMPurify from 'dompurify'

marked.use(gfmHeadingId())

/** @param {string} title */
const heading_id = title => {
  const title_str = String(title || '')
  return title_str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * @param {string} [content]
 * @returns {Array<{ id: string, title: string, level: number }>}
 */
export const documentation_toc = (content = documentation_md) => {
  const toc = []
  for (const line of content.split('\n')) {
    const heading_match = line.match(/^(#{2,6})\s+(.+)$/)
    if (!heading_match) continue
    const level = heading_match[1].length
    const title = heading_match[2].trim()
    toc.push({ id: heading_id(title), title: String(title || ''), level })
  }
  return toc
}

/**
 * @param {string} rendered
 * @returns {string}
 */
const sanitize_html = rendered => {
  if (import.meta.env.SSR) return String(rendered)
  return DOMPurify.sanitize(rendered)
}

/**
 * @param {string} [content]
 * @returns {string}
 */
export const documentation_html = (content = documentation_md) =>
  sanitize_html(String(marked.parse(content)))
