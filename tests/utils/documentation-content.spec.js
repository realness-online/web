import { describe, it, expect } from 'vite-plus/test'
import {
  documentation_html,
  documentation_toc
} from '@/utils/documentation-content'

describe('documentation-content', () => {
  it('builds a table of contents from headings', () => {
    const toc = documentation_toc('## Overview\n\n## Posters\n')
    expect(toc).toEqual([
      { id: 'overview', title: 'Overview', level: 2 },
      { id: 'posters', title: 'Posters', level: 2 }
    ])
  })

  it('renders markdown to HTML', () => {
    const html = documentation_html('## Hello\n\nParagraph text.')
    expect(html).toContain('id="hello"')
    expect(html).toContain('<p>Paragraph text.</p>')
  })
})
