import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'

const fetch_mock = vi.fn()
const origin = 'https://demo.web.app'

describe('@/use/instance-capabilities', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', fetch_mock)
    vi.stubGlobal('location', { origin })
    fetch_mock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('reads the live manifest from the same origin', async () => {
    fetch_mock.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ push: true, phone_integrity: false })
    })

    const { probe_instance_capabilities, use_instance_capabilities } =
      await import('@/use/instance-capabilities')

    await probe_instance_capabilities()
    const { push, phone_integrity } = use_instance_capabilities()

    expect(fetch_mock).toHaveBeenCalledWith(
      `${origin}/capabilities`,
      expect.objectContaining({ method: 'GET' })
    )
    expect(push.value).toBe(true)
    expect(phone_integrity.value).toBe(false)
  })

  it('falls back to capabilities.json when the live manifest is unavailable', async () => {
    fetch_mock
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ push: false, phone_integrity: false })
      })

    const { probe_instance_capabilities, use_instance_capabilities } =
      await import('@/use/instance-capabilities')

    await probe_instance_capabilities()
    const { push } = use_instance_capabilities()

    expect(fetch_mock).toHaveBeenNthCalledWith(
      1,
      `${origin}/capabilities`,
      expect.any(Object)
    )
    expect(fetch_mock).toHaveBeenNthCalledWith(
      2,
      `${origin}/capabilities.json`,
      expect.any(Object)
    )
    expect(push.value).toBe(false)
  })

  it('uses VITE_FUNCTIONS_URL first when set (dev override)', async () => {
    vi.stubEnv('VITE_FUNCTIONS_URL', 'http://127.0.0.1:5001/demo/us-central1')
    fetch_mock.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ push: true, phone_integrity: true })
    })

    const { probe_instance_capabilities } =
      await import('@/use/instance-capabilities')

    await probe_instance_capabilities()

    expect(fetch_mock).toHaveBeenCalledWith(
      'http://127.0.0.1:5001/demo/us-central1/capabilities',
      expect.any(Object)
    )
    expect(fetch_mock).toHaveBeenCalledTimes(1)
  })

  it('returns the cached result on a second probe', async () => {
    fetch_mock.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ push: true, phone_integrity: true })
    })

    const { probe_instance_capabilities } =
      await import('@/use/instance-capabilities')

    await probe_instance_capabilities()
    await probe_instance_capabilities()

    expect(fetch_mock).toHaveBeenCalledTimes(1)
  })
})
