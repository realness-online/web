import { describe, expect, it, vi } from 'vite-plus/test'
import { published_url } from '@/utils/published-url'

const serve = body => vi.fn(async () => ({ ok: true, json: async () => body }))

describe('@/utils/published-url', () => {
  it('finds the page an itemid was published to', async () => {
    const fetch = serve([
      { id: '/+1555/plans/1', url: 'https://site.test/sites/a-1/one/' },
      { id: '/+1555/plans/2', url: 'https://site.test/sites/a-1/two/' }
    ])
    expect(await published_url('/+1555/plans/2', fetch)).toBe(
      'https://site.test/sites/a-1/two/'
    )
    expect(fetch).toHaveBeenCalledWith('/sites/index.json')
  })

  it('stays quiet when the note has no itemid or no snapshot', async () => {
    const fetch = serve([])
    expect(await published_url(null, fetch)).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(await published_url('/+1555/plans/3', fetch)).toBeNull()
  })

  it('treats an unreadable index as unpublished', async () => {
    const fetch = vi.fn(async () => ({ ok: false, json: async () => [] }))
    expect(await published_url('/+1555/plans/4', fetch)).toBeNull()
    const broken = vi.fn(async () => {
      throw new Error('offline')
    })
    expect(await published_url('/+1555/plans/4', broken)).toBeNull()
  })
})
