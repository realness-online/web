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
 * Build a table of contents from any markdown's h2–h6 headings.
 * @param {string} content
 * @returns {Array<{ id: string, title: string, level: number }>}
 */
export const markdown_toc = content => {
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
 * @param {string} [content]
 * @returns {Array<{ id: string, title: string, level: number }>}
 */
export const documentation_toc = (content = documentation_md) => [
  ...markdown_toc(content),
  ...documentation_preferences_toc
]

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

/**
 * Render arbitrary markdown (legal pages, etc.) to sanitized HTML.
 * @param {string} content
 * @returns {string}
 */
export const markdown_html = content => documentation_html(content)

export const INSTALL_GUIDE_MARKER = '<!-- install-guide -->'

export const INSTANCE_PROMPT_MARKER = '<!-- instance-prompt -->'

/**
 * @param {string} content
 * @returns {{ after: string, realness: string }}
 */
const split_instance_prompt = content => {
  const marker_index = content.indexOf(INSTANCE_PROMPT_MARKER)
  if (marker_index === -1)
    return { after: documentation_html(content), realness: '' }

  return {
    after: documentation_html(content.slice(0, marker_index)),
    realness: documentation_html(
      content.slice(marker_index + INSTANCE_PROMPT_MARKER.length)
    )
  }
}

/**
 * @param {string} [content]
 * @returns {{ before: string, after: string, realness: string, has_install_guide: boolean }}
 */
export const documentation_html_parts = (content = documentation_md) => {
  const marker_index = content.indexOf(INSTALL_GUIDE_MARKER)
  if (marker_index === -1)
    return {
      before: documentation_html(content),
      after: '',
      realness: '',
      has_install_guide: false
    }

  return {
    before: documentation_html(content.slice(0, marker_index)),
    ...split_instance_prompt(
      content.slice(marker_index + INSTALL_GUIDE_MARKER.length)
    ),
    has_install_guide: true
  }
}
