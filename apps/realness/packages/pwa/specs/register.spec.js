import { describe, expect, it, vi } from 'vitest'
import { register_pwa } from '../src/register.js'

const page = () => {
  const registration = { update: vi.fn(async () => {}) }
  const serviceWorker = Object.assign(new EventTarget(), {
    controller: {},
    register: vi.fn(async () => registration),
    getRegistration: vi.fn(async () => registration)
  })
  return { registration, nav: { serviceWorker } }
}

describe('register_pwa', () => {
  it('registers the worker and follows the update rule', async () => {
    const { registration, nav } = page()
    const stop = await register_pwa({ nav, win: window })
    expect(nav.serviceWorker.register).toHaveBeenCalledWith(
      '/service.worker.js'
    )
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalled())
    stop()
  })

  it('does nothing where service workers do not exist', async () => {
    expect(await register_pwa({ nav: {}, win: window })).toBeUndefined()
  })
})
