import { describe, it, expect } from 'vite-plus/test'
import {
  documentation_html,
  documentation_html_parts,
  documentation_preferences_toc,
  documentation_toc,
  inline_documentation_icons,
  INSTALL_GUIDE_MARKER
} from '@/utils/documentation-content'

describe('documentation-content', () => {
  it('builds a table of contents from headings', () => {
    const toc = documentation_toc('## Overview\n\n## Posters\n')
    expect(toc).toEqual([
      { id: 'overview', title: 'Overview', level: 2 },
      { id: 'posters', title: 'Posters', level: 2 },
      ...documentation_preferences_toc
    ])
  })

  it('renders markdown to HTML', () => {
    const html = documentation_html('## Hello\n\nParagraph text.')
    expect(html).toContain('id="hello"')
    expect(html).toContain('<p>Paragraph text.</p>')
  })

  it('inlines island icons from the sprite', () => {
    const html = documentation_html(
      '- <svg><use href="/icons.svg#add"></use></svg> **Add**'
    )
    expect(html).toContain('class="inline-icon"')
    expect(html).toContain('viewBox="0 0 16 16"')
    expect(html).not.toContain('<use href="/icons.svg#add">')
  })

  it('marks animation icons for stroke styling', () => {
    const html = inline_documentation_icons(
      '<svg><use href="/icons.svg#animation"></use></svg>'
    )
    expect(html).toContain('class="inline-icon animation"')
  })

  it('inlines icons after marked parse', () => {
    const html = inline_documentation_icons(
      '<svg><use href="/icons.svg#gear"></use></svg>'
    )
    expect(html).toContain('class="inline-icon"')
    expect(html).not.toContain('<use')
  })

  it('splits markdown at the install guide marker', () => {
    const md = `### Install\n\nIntro.\n\n${INSTALL_GUIDE_MARKER}\n\n---\n\n### Sync`
    const parts = documentation_html_parts(md)
    expect(parts.has_install_guide).toBe(true)
    expect(parts.before).toContain('id="install"')
    expect(parts.before).toContain('Intro.')
    expect(parts.after).toContain('id="sync"')
    expect(parts.before).not.toContain(INSTALL_GUIDE_MARKER)
  })
})
