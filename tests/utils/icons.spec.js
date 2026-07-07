import { describe, it, expect } from 'vite-plus/test'
import { icon_names, icon_names_from_svg } from '@/utils/icons'

describe('icons', () => {
  it('lists symbol ids from icons.svg in document order', () => {
    expect(icon_names.length).toBeGreaterThan(0)
    expect(icon_names).toContain('realness')
    expect(icon_names).toContain('add')
  })

  it('parses symbol ids from arbitrary svg', () => {
    const svg = `
      <symbol id="alpha"></symbol>
      <symbol id="beta" viewBox="0 0 16 16"></symbol>
    `
    expect(icon_names_from_svg(svg)).toEqual(['alpha', 'beta'])
  })
})
