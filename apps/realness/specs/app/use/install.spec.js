import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'

const dispatch_install_event = () => {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  event.prompt = vi.fn()
  event.userChoice = Promise.resolve({ outcome: 'accepted' })
  window.dispatchEvent(event)
  return event
}

describe('@/use/install', () => {
  beforeEach(async () => {
    vi.resetModules()
  })

  it('offers no install until the browser says it can', async () => {
    const { use_install } = await import('@/use/install')
    const install = use_install()

    expect(install.can_install.value).toBe(false)
    expect(await install.prompt_install()).toBeNull()
  })

  it('offers install once the browser event arrives', async () => {
    const { use_install } = await import('@/use/install')
    const install = use_install()

    dispatch_install_event()

    expect(install.can_install.value).toBe(true)
  })

  it('prompts and reports the outcome the user chose', async () => {
    const { use_install } = await import('@/use/install')
    const install = use_install()
    const event = dispatch_install_event()

    const outcome = await install.prompt_install()

    expect(event.prompt).toHaveBeenCalled()
    expect(outcome).toBe('accepted')
    expect(install.can_install.value).toBe(false)
  })

  it('marks the app installed when the browser confirms it', async () => {
    const { use_install } = await import('@/use/install')
    const install = use_install()
    dispatch_install_event()

    window.dispatchEvent(new Event('appinstalled'))

    expect(install.installed.value).toBe(true)
    expect(install.can_install.value).toBe(false)
  })

  it('prevents the browser default install banner', async () => {
    await import('@/use/install')
    const event = dispatch_install_event()

    expect(event.defaultPrevented).toBe(true)
  })

  it('reports how the app was installed', async () => {
    const { use_install } = await import('@/use/install')

    const method = use_install().method
    expect(typeof method.video).toBe('string')
    expect(typeof method.label).toBe('string')
    expect(typeof method.can_prompt).toBe('boolean')
  })
})
