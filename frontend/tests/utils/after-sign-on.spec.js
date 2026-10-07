import { describe, it, expect } from 'vite-plus/test'
import { after_sign_on } from '@/utils/after-sign-on'

describe('after_sign_on', () => {
  it('goes to the account page by default', () => {
    expect(after_sign_on(undefined)).toBe('/account')
    expect(after_sign_on({})).toBe('/account')
  })

  it('follows a next path on this site', () => {
    expect(after_sign_on({ next: '/discover?x=1' })).toBe('/discover?x=1')
  })

  it('never follows a next that leaves the site', () => {
    expect(after_sign_on({ next: 'https://evil.example' })).toBe('/account')
    expect(after_sign_on({ next: '//evil.example' })).toBe('/account')
    expect(after_sign_on({ next: ['/a', '/b'] })).toBe('/account')
  })
})
