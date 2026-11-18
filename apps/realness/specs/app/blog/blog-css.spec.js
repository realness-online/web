/**
 * b2: the blog page wears the renderer's own stylesheet, held to itself.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'
import { limit_blog_css } from '@/blog/blog-css'

const renderer_css = readFileSync(
  'tools/publish/renderer/static/style.css',
  'utf8'
)
const limited = limit_blog_css(renderer_css)

/** The stylesheet's top-level blocks, in order. */
const top_level = css => {
  const found = []
  let depth = 0
  let start = 0
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) {
      found.push(css.slice(start, i + 1).trim())
      start = i + 1
    }
  }
  return found.filter(Boolean)
}

describe('@/blog/blog-css', () => {
  it('reads the one renderer stylesheet, not a copy', () => {
    expect(renderer_css).toContain('--h3-min')
    expect(renderer_css.length).toBeGreaterThan(20000)
  })

  it('leaves no page-wide rule loose', () => {
    const blocks = top_level(limited)
    expect(blocks.length).toBeGreaterThan(20)
    const loose = blocks.filter(
      block =>
        !block.startsWith('main[data-blog]') &&
        !block.startsWith('@keyframes') &&
        !block.startsWith('@page')
    )
    expect(loose).toEqual([])
  })

  it('drops the blog fonts and no page rule escapes the blog page', () => {
    expect(limited).not.toContain('@font-face')
    expect(limited).not.toMatch(/^:root/m)
    expect(limited).not.toMatch(/^body\s*\{/m)
    expect(limited).toContain('main[data-blog] {')
  })

  it('lets a blog paragraph run the width of its column', () => {
    expect(limited).toContain('main[data-blog] p {\n  max-width: none;\n}')
  })

  it('takes the blog type scale and its own measurements', () => {
    expect(limited).toContain('--measure: 50ch')
    expect(limited).toMatch(/main\[data-blog\] \{\n  font-family: Lato/)
  })

  it('keeps keyframes and print pages global', () => {
    expect(limited).toContain('@keyframes poster-fit')
    expect(limited).toContain('@page')
  })

  it('lets the app page header take the blog header rules', () => {
    expect(limited).toContain(
      'main[data-blog] {\n  min-height: 100dvh;\n\n  header {'
    )
  })

  it('holds the app-wide selectors to the blog page', () => {
    for (const selector of ['nav', 'figure', 'footer', 'section', 'mark'])
      expect(limited).toMatch(
        new RegExp(`main\\[data-blog\\] \\{\\n${selector}[\\s,{]`)
      )
    expect(limited).toMatch(/main\[data-blog\] \{\nstrong,\nb \{/)
  })
})
