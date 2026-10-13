import { describe, it, expect, beforeEach } from 'vite-plus/test'
import css_var from '@/utils/css-var'

describe('@/utils/css-var', () => {
  beforeEach(() => {
    document.documentElement.style.setProperty('--test-color', ' rgb(1, 2, 3) ')
  })

  it('reads computed custom property from document root', () => {
    expect(css_var('--test-color')).toBe('rgb(1, 2, 3)')
  })
})
