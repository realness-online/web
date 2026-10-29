import { describe, expect, it } from 'vitest'
import { match_theme } from '../../../tools/publish/renderer/static/scripts/parts.js'

describe('match_theme', () => {
  it('points diagram colors at page roles, so they follow light and dark', () => {
    const node = document.createElement('pre')
    match_theme(node)
    expect(node.style.getPropertyValue('--pele-fg')).toBe('var(--text)')
    expect(node.style.getPropertyValue('--pele-bg')).toBe('var(--surface)')
    expect(node.style.getPropertyValue('--pele-line')).toBe('var(--muted-text)')
  })
})
