import { describe, expect, it } from 'vite-plus/test'
import { readFileSync as read } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '../../..')
const source = path => read(join(root, path), 'utf8')

describe('a drawn diagram keeps its own size', () => {
  it('the app sets diagram svg width and height free of the icon size', () => {
    const css = source('src/app/style/mermaid.css')
    const rule = css.slice(css.indexOf('pre.mermaid svg'))
    expect(rule).toMatch(/width:\s*auto/)
    expect(rule).toMatch(/height:\s*auto/)
  })

  it('every view that draws a diagram imports that rule', () => {
    for (const view of [
      'src/app/views/Vault.vue',
      'src/app/views/Planning.vue',
      'src/app/components/page/as-article.vue'
    ])
      expect(source(view)).toContain("import '@/style/mermaid.css'")
  })
})
