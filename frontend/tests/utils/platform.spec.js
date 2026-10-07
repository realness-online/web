import { describe, it, expect, beforeEach, afterEach } from 'vite-plus/test'
import {
  is_standalone,
  is_ipad,
  is_ios,
  is_android,
  is_firefox,
  is_chromium,
  install_method
} from '@/utils/platform'

// Save real navigator to restore under each platform stub
const real_navigator = globalThis.navigator

const stub_agent = ua => {
  const nav = { ...(real_navigator || {}), userAgent: ua }
  vi.stubGlobal('navigator', nav)
  return nav
}

const stub_platform = (platform, max_touch) => {
  vi.stubGlobal('navigator', {
    ...(real_navigator || {}),
    platform,
    maxTouchPoints: max_touch
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

beforeEach(() => {
  // give every test a neutral navigator with no identifying UA tokens
  const nav = {
    ...(real_navigator || {}),
    userAgent: 'Mozilla/5.0 (X11; Linux)'
  }
  vi.stubGlobal('navigator', nav)
})

describe('is_standalone', () => {
  it('is true when display-mode standalone matches', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
      navigator: { standalone: false }
    })
    expect(is_standalone()).toBe(true)
  })

  it('is true when navigator.standalone is set', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
      navigator: { standalone: true }
    })
    expect(is_standalone()).toBe(true)
  })

  it('is false when in a normal browser tab', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
      navigator: { standalone: false }
    })
    expect(is_standalone()).toBe(false)
  })

  it('is false when there is no window', () => {
    vi.stubGlobal('window', undefined)
    expect(is_standalone()).toBe(false)
  })

  it('is false when matchMedia is missing', () => {
    vi.stubGlobal('window', { navigator: {} })
    expect(is_standalone()).toBe(false)
  })
})

describe('platform detection', () => {
  it('detects an iPad by MacIntel platform with a touch screen', () => {
    stub_platform('MacIntel', 5)
    expect(is_ipad()).toBe(true)
    expect(is_ios()).toBe(true)
  })

  it('detects iOS from the user agent', () => {
    stub_agent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    expect(is_ios()).toBe(true)
  })

  it('detects android from the user agent', () => {
    stub_agent('Mozilla/5.0 (Linux; Android 14)')
    expect(is_android()).toBe(true)
    expect(is_ios()).toBe(false)
  })

  it('detects firefox and chromium from the user agent', () => {
    stub_agent(
      'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0'
    )
    expect(is_firefox()).toBe(true)
    expect(is_chromium()).toBe(false)
    stub_agent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0'
    )
    expect(is_chromium()).toBe(true)
    expect(is_firefox()).toBe(false)
  })
})

describe('install_method', () => {
  it('returns the iOS flow with no prompt', () => {
    stub_agent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    expect(install_method()).toMatchObject({
      video: 'ios-safari',
      label: 'iPhone · Safari',
      noun: 'home screen',
      can_prompt: false
    })
  })

  it('labels an iPad install separately', () => {
    // iPad reports macOS UA but has a touch screen (MacIntel + maxTouchPoints>1)
    vi.stubGlobal('navigator', {
      ...(real_navigator || {}),
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
      platform: 'MacIntel',
      maxTouchPoints: 5
    })
    expect(install_method()).toMatchObject({
      video: 'ios-safari',
      label: 'iPad · Safari'
    })
  })

  it('returns the android flow that can prompt', () => {
    stub_agent('Mozilla/5.0 (Linux; Android 14)')
    expect(install_method()).toMatchObject({
      video: 'android-chrome',
      label: 'Android · Chrome',
      can_prompt: true
    })
  })

  it('returns the firefox flow with no video', () => {
    stub_agent(
      'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0'
    )
    expect(install_method()).toMatchObject({
      video: null,
      label: 'Firefox',
      can_prompt: false
    })
  })

  it('returns the chrome flow that can prompt', () => {
    stub_agent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0'
    )
    expect(install_method()).toMatchObject({
      video: 'desktop-chromium',
      label: 'Chrome · Edge · Brave',
      can_prompt: true
    })
  })

  it('falls back to macOS safari flow', () => {
    stub_agent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15'
    )
    expect(install_method()).toMatchObject({
      video: 'macos-safari',
      label: 'macOS · Safari',
      can_prompt: false
    })
  })
})
