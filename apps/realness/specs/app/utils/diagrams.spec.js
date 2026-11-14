/**
 * b2: one broken diagram keeps its own text and the others still draw.
 */
import { afterEach as after_each, expect, it, vi } from 'vite-plus/test'

const draw = vi.fn(async ([node]) => {
  if (node.textContent?.includes('broken')) throw new Error('bad source')
  node.replaceChildren(document.createElement('svg'))
})
const size_diagrams = vi.fn()

vi.mock('#root/tools/publish/renderer/static/scripts/parts.js', () => ({
  draw_diagrams: draw
}))
vi.mock('#root/tools/publish/renderer/static/scripts/plan-diagrams.js', () => ({
  size_diagrams
}))
vi.mock('pele', () => ({ mount: vi.fn() }))

import { draw_diagrams, mark_diagrams } from '@/utils/diagrams'

after_each(() => {
  draw.mockClear()
  size_diagrams.mockClear()
})

const container = html => {
  const element = document.createElement('article')
  element.innerHTML = html
  return element
}

it('draws every readable diagram and leaves a broken one as text', async () => {
  const page = container(
    '<pre class="mermaid">flowchart LR</pre><pre class="mermaid">broken diagram</pre><pre class="mermaid">flowchart TD</pre>'
  )
  const failed = await draw_diagrams(page)
  expect(failed).toEqual(['broken diagram'])
  const blocks = [...page.querySelectorAll('pre.mermaid')]
  expect(blocks[0].querySelector('svg')).not.toBeNull()
  expect(blocks[1].textContent).toBe('broken diagram')
  expect(blocks[2].querySelector('svg')).not.toBeNull()
  expect(size_diagrams).toHaveBeenCalledWith([blocks[0], blocks[2]])
})

it('reads a fenced Mermaid block into a drawable one', () => {
  const page = container(
    '<pre><code class="language-mermaid">flowchart LR</code></pre>'
  )
  mark_diagrams(page)
  const pre = page.querySelector('pre')
  expect(pre?.className).toBe('mermaid')
  expect(pre?.textContent).toBe('flowchart LR')
})
