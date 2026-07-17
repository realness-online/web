import { describe, it, expect } from 'vite-plus/test'
import {
  documentation_html,
  documentation_html_parts,
  documentation_preferences_toc,
  documentation_changelog_toc,
  documentation_toc,
  inline_documentation_icons,
  markdown_html,
  markdown_toc,
  changelog_html,
  strip_changelog_unreleased,
  INSTALL_GUIDE_MARKER,
  INSTANCE_PROMPT_MARKER
} from '@/utils/markdown'

describe('markdown', () => {
  it('builds a table of contents from headings', () => {
    const toc = documentation_toc('## Overview\n\n## Posters\n')
    expect(toc).toEqual([
      { id: 'overview', title: 'Overview', level: 2 },
      { id: 'posters', title: 'Posters', level: 2 },
      ...documentation_preferences_toc,
      ...documentation_changelog_toc
    ])
  })

  it('builds a generic toc without the preferences section', () => {
    const toc = markdown_toc('## Terms\n\n### Eligibility\n')
    expect(toc).toEqual([
      { id: 'terms', title: 'Terms', level: 2 },
      { id: 'eligibility', title: 'Eligibility', level: 3 }
    ])
  })

  it('renders arbitrary markdown via markdown_html', () => {
    const html = markdown_html('## Privacy\n\nWe collect little.')
    expect(html).toContain('id="privacy"')
    expect(html).toContain('<p>We collect little.</p>')
  })

  it('strips Unreleased from public changelog HTML', () => {
    const md = `# Changelog

## Unreleased

- **secret** — WIP

## 2026-07-16 — v2.5.12

- **shipped** — live
`
    expect(strip_changelog_unreleased(md)).not.toContain('secret')
    const html = changelog_html(md)
    expect(html).not.toContain('secret')
    expect(html).toContain('shipped')
    expect(html).not.toMatch(/Unreleased/i)
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

  it('splits the realness section at the instance prompt marker', () => {
    const md = `### Install\n\nIntro.\n\n${INSTALL_GUIDE_MARKER}\n\nSync notes.\n\n${INSTANCE_PROMPT_MARKER}\n\n### A realness of your own\n\nDeploy your own.`
    const parts = documentation_html_parts(md)
    expect(parts.after).toContain('Sync notes.')
    expect(parts.after).not.toContain('id="a-realness-of-your-own"')
    expect(parts.realness).toContain('id="a-realness-of-your-own"')
    expect(parts.realness).toContain('Deploy your own.')
  })
})
