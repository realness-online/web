import documentation_md from '@/content/documentation.md?raw'
import icons_svg from '../../public/icons.svg?raw'
import { marked } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import DOMPurify from 'dompurify'

marked.use(gfmHeadingId())

/** @type {Map<string, string>} */
const icon_symbol_cache = new Map()

/** @param {string} name */
const inline_icon_symbol = name => {
  if (icon_symbol_cache.has(name)) return icon_symbol_cache.get(name)

  const symbol_match = icons_svg.match(
    new RegExp(`<symbol[^>]*id="${name}"[^>]*>[\\s\\S]*?</symbol>`)
  )
  if (!symbol_match) return ''

  const [symbol] = symbol_match
  const viewbox = symbol.match(/viewBox="([^"]*)"/)?.[1] || '0 0 16 16'
  const inner = symbol.replace(/<symbol[^>]*>/, '').replace(/<\/symbol>/, '')
  const icon_class =
    name === 'animation' ? 'inline-icon animation' : 'inline-icon'
  const svg = `<svg class="${icon_class}" viewBox="${viewbox}" aria-hidden="true">${inner}</svg>`
  icon_symbol_cache.set(name, svg)
  return svg
}

/** @param {string} html */
export const inline_documentation_icons = html =>
  html.replace(
    /<svg([^>]*)><use href="\/icons\.svg#([^"]+)"><\/use><\/svg>/g,
    (_, attrs, name) => {
      const inlined = inline_icon_symbol(name)
      if (!inlined)
        return `<svg${attrs}><use href="/icons.svg#${name}"></use></svg>`
      return inlined
    }
  )

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

/** @type {Array<{ id: string, title: string, level: number }>} */
export const documentation_preferences_toc = [
  { id: 'preferences', title: 'Preferences', level: 2 },
  { id: 'preferences-mosaic', title: 'Mosaic', level: 3 },
  { id: 'preferences-shadow', title: 'Shadow', level: 3 },
  { id: 'preferences-motion', title: 'Motion', level: 3 },
  { id: 'preferences-view', title: 'View', level: 3 },
  { id: 'preferences-chrome', title: 'Chrome', level: 3 }
]

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
  return [...toc, ...documentation_preferences_toc]
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
export const documentation_html = (content = documentation_md) => {
  const rendered = inline_documentation_icons(String(marked.parse(content)))
  return sanitize_html(rendered)
}
