import { describe, it, expect } from 'vitest'
import { documentation_html_parts } from '@/utils/markdown'
import { documentation_toc } from '@/prerender/toc'

const parts = documentation_html_parts()
const html = [parts.before, parts.after, parts.realness].join('\n')
const ids = new Set(
  [...html.matchAll(/<h[2-6][^>]*\sid="([^"]+)"/g)].map(match => match[1])
)
const from_vue = id => /^(preferences|changelog)/.test(id)

describe('documentation links', () => {
  it('every table of contents entry has a heading', () => {
    const missing = documentation_toc
      .map(entry => entry.id)
      .filter(id => !ids.has(id) && !from_vue(id))
    expect(missing).toEqual([])
  })

  it('every link to a section names a heading on the page', () => {
    const targets = [...html.matchAll(/href="(?:\/docs)?#([^"]+)"/g)].map(
      match => decodeURIComponent(match[1])
    )
    expect(targets.filter(id => !ids.has(id) && !from_vue(id))).toEqual([])
  })
})
