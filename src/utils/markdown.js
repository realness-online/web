import documentation_md from '@/content/documentation.md?raw'
import changelog_md from '../../CHANGELOG.md?raw'
import icons_svg from '../../public/icons.svg?raw'
import { marked } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'

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
  // Match marked-gfm-heading-id (github-slugger): strip punctuation, then turn
  // each remaining whitespace char into a hyphen WITHOUT collapsing runs — so
  // "Subjects — being built live" slugs to "subjects--being-built-live", the
  // same id the rendered heading gets. Collapsing here would break that anchor.
  return title_str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s/g, '-')
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

/** @type {Array<{ id: string, title: string, level: number }>} */
export const documentation_changelog_toc = [
  { id: 'changelog', title: 'Changelog', level: 2 }
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
  ...documentation_preferences_toc,
  ...documentation_changelog_toc
]

/**
 * @param {string} [content]
 * @returns {string}
 */
export const documentation_html = (content = documentation_md) =>
  inline_documentation_icons(String(marked.parse(content)))

/**
 * Render our own first-party markdown (legal pages, etc.) to HTML.
 * @param {string} content
 * @returns {string}
 */
export const markdown_html = content => documentation_html(content)

/** @param {string} text */
const humanize_dates = text =>
  text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, y, m, d) =>
    new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  )

/**
 * CHANGELOG.md dates its entries in ISO (sorts cleanly as a dev log);
 * humanize them and drop the leading "# Changelog" so it can sit under this
 * page's own "Changelog" heading instead of rendering its own.
 * @param {string} [content]
 * @returns {string}
 */
export const changelog_html = (content = changelog_md) =>
  documentation_html(humanize_dates(content.replace(/^#\s+.+\n+/, '')))

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
