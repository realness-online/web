import { Window } from 'happy-dom'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

describe('poster with sale record round-trips through happy-dom', () => {
  const file = join(import.meta.dirname, '../../../frontend/tests/mocks/html/poster.html')
  it('parses, accepts metadata, serializes', () => {
    const html = readFileSync(file, 'utf8')
    const win = new Window({ url: 'https://realness.online' })
    const container = win.document.createElement('div')
    container.innerHTML = html
    const root = container.firstElementChild
    expect(root?.getAttribute('itemid')).toContain('/posters/')

    const md = win.document.createElementNS('http://www.w3.org/2000/svg', 'metadata')
    md.setAttribute('itemprop', 'sale')
    md.setAttribute('itemscope', '')
    const price = win.document.createElement('data')
    price.setAttribute('itemprop', 'price')
    price.setAttribute('value', '500')
    price.textContent = '$500'
    md.appendChild(price)
    root.appendChild(md)

    const out = container.innerHTML
    expect(out).toContain('itemprop="sale"')
    expect(out).toContain('itemprop="light"')
    expect(out).toContain('itemprop="sale"')
  })
})
