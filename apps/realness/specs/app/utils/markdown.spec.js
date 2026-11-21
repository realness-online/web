import { describe, it, expect } from 'vite-plus/test'
import {
  documentation_html,
  documentation_html_parts,
  inline_documentation_icons,
  markdown_html,
  highlight_code,
  changelog_html,
  strip_changelog_unreleased,
  INSTALL_GUIDE_MARKER,
  INSTANCE_PROMPT_MARKER
} from '@/utils/markdown'
import { markdown_toc } from '../../../scripts/generate-toc.js'
import documentation_md from '@/content/documentation.md?raw'

describe('markdown', () => {
  it('renders every heading at the id the generated toc links to', () => {
    const html = documentation_html(documentation_md)
    const missing = markdown_toc(documentation_md)
      .map(({ id }) => id)
      .filter(id => !html.includes(`id="${id}"`))
    expect(missing).toEqual([])
  })

  it('opens outside links in a new tab', () => {
    const html = markdown_html(
      '[out](https://vuejobs.com/a) [in](/+A/plans/1/)\n\n<a href="https://news.ycombinator.com/item?id=1">hn</a>'
    )
    expect(html).toContain(
      '<a href="https://vuejobs.com/a" target="_blank" rel="noopener">out</a>'
    )
    expect(html).toContain(
      '<a href="https://news.ycombinator.com/item?id=1" target="_blank" rel="noopener">hn</a>'
    )
    expect(html).toContain('<a href="/+A/plans/1/">in</a>')
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

  it('colors a fenced code block and leaves mermaid as text', async () => {
    const html = markdown_html(
      '```js\nconst a = 1\n```\n\n```mermaid\nflowchart LR\n```'
    )
    const drawn = await highlight_code(html)
    expect(drawn).toContain('<pre class="shiki')
    expect(drawn).toContain('--shiki-light')
    expect(drawn).toContain('<pre><code class="language-mermaid">')
  })
})
