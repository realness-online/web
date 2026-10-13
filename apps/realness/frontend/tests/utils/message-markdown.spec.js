import { describe, it, expect } from 'vite-plus/test'
import { message_html, PARTS } from '@/utils/message-markdown'

const fence = (lang, body) => `\`\`\`${lang}\n${body}\n\`\`\``

/** Parse output as a page would, so assertions read elements, not strings. */
const dom = html => {
  const template = document.createElement('template')
  template.innerHTML = html
  return template.content
}

describe('message_html', () => {
  it('allows only mermaid and cardlink parts', () => {
    expect(PARTS).toEqual(['mermaid', 'cardlink'])
  })

  it('turns a mermaid fence into an inert diagram part', () => {
    const page = dom(message_html(fence('mermaid', 'flowchart LR\n  a --> b')))
    const part = page.querySelector('pre.mermaid')
    expect(part.textContent).toBe('flowchart LR\n  a --> b')
    expect(part.children).toHaveLength(0)
  })

  it('turns a cardlink fence into an inert card part', () => {
    const body = 'url: https://example.com\ntitle: Example'
    const part = dom(message_html(fence('cardlink', body))).querySelector(
      'pre.cardlink'
    )
    expect(part.textContent).toBe(body)
  })

  it('marks a part busy until its fence closes', () => {
    const open = dom(message_html('```mermaid\nflowchart LR\n  a -'))
    expect(open.querySelector('pre.mermaid').getAttribute('aria-busy')).toBe(
      'true'
    )
    const closed = dom(message_html(fence('mermaid', 'flowchart LR')))
    expect(closed.querySelector('pre.mermaid').hasAttribute('aria-busy')).toBe(
      false
    )
    const half = dom(message_html('```cardlink\nurl: https://a.b\n``'))
    expect(half.querySelector('pre.cardlink').getAttribute('aria-busy')).toBe(
      'true'
    )
    const tilde = dom(message_html('~~~cardlink\nurl: https://a.b\n~~~'))
    expect(tilde.querySelector('pre.cardlink').hasAttribute('aria-busy')).toBe(
      false
    )
  })

  it('reads the fence language case and info string loosely', () => {
    const page = dom(message_html(fence('Mermaid title="x"', 'flowchart LR')))
    expect(page.querySelector('pre.mermaid')).not.toBeNull()
  })

  it('keeps other fences as plain code', () => {
    const page = dom(message_html(fence('js', 'const a = 1')))
    expect(page.querySelector('pre.js')).toBeNull()
    expect(page.querySelector('pre > code').textContent).toBe('const a = 1\n')
  })

  it('keeps script, style, and event attributes inside a part as text', () => {
    const body =
      '<script>alert(1)</script><style>*{}</style><img src=x onerror=alert(1)>'
    const page = dom(message_html(fence('mermaid', body)))
    expect(page.querySelector('script, style, img, [onerror]')).toBeNull()
    expect(page.querySelector('pre.mermaid').textContent).toBe(body)
  })

  it('keeps a fence language from breaking out of its attribute', () => {
    const page = dom(message_html(fence('"><img src=x onerror=alert(1)>', 'x')))
    expect(page.querySelector('img, [onerror]')).toBeNull()
  })

  it('still shows raw HTML outside fences as text', () => {
    const page = dom(message_html('<script>alert(1)</script> hi'))
    expect(page.querySelector('script')).toBeNull()
    expect(page.textContent).toContain('<script>alert(1)</script>')
  })
})
