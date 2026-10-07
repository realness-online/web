import { describe, expect, it } from 'vitest'
import { shadow_luminosity, shadow_value_hint } from '@/utils/shadow-values'

describe('shadow-values', () => {
  it('defines luminosity targets in darkest-to-lightest order for paths', () => {
    expect(shadow_luminosity.bold).toBeLessThan(shadow_luminosity.medium)
    expect(shadow_luminosity.medium).toBeLessThan(shadow_luminosity.regular)
    expect(shadow_luminosity.regular).toBeLessThan(shadow_luminosity.light)
    expect(shadow_luminosity.light).toBeLessThan(shadow_luminosity.background)
  })

  it('describes shadow value ranges from luminosity targets', () => {
    expect(shadow_value_hint.bold).toBe('0-10% luminosity')
    expect(shadow_value_hint.medium).toBe('10-20% luminosity')
    expect(shadow_value_hint.regular).toBe('20-44% luminosity')
    expect(shadow_value_hint.light).toBe('44-60% luminosity')
    expect(shadow_value_hint.background).toBe('81% luminosity fill')
  })
})
