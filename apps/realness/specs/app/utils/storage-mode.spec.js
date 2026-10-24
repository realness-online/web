import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('@/utils/upload-processor', () => ({
  create_hash: vi.fn(async html => `firebase:${html}`)
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('storage mode', () => {
  it('outside dev-local it is Firebase: plain fetch and the HTML hash', async () => {
    const { synced, hash_of, fetch_file } = await import('@/utils/storage-mode')
    expect(synced).toBeNull()
    expect(await hash_of('<p>')).toBe('firebase:<p>')
    globalThis.fetch = vi.fn(async () => new Response('ok'))
    await fetch_file('https://example.test/a')
    expect(globalThis.fetch).toHaveBeenCalledWith('https://example.test/a')
  })

  it('in dev-local it is sync, signed by the token serverless names', async () => {
    vi.stubEnv('MODE', 'dev-local')
    const { synced, hash_of, fetch_file, use_token } =
      await import('@/utils/storage-mode')
    expect(synced).not.toBeNull()
    expect(await hash_of('<p itemscope>hello</p>')).toBe(
      'cbH7B_H6f86SGDvYIHa_yh'
    )
    use_token(async () => 'tok')
    globalThis.fetch = vi.fn(async () => new Response('ok'))
    await fetch_file('/sync/a.html')
    expect(globalThis.fetch).toHaveBeenCalledWith('/sync/a.html', {
      headers: { authorization: 'Bearer tok' }
    })
  })
})
