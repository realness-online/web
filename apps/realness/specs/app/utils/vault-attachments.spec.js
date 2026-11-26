/**
 * A note's images beside it load with the reader's token and show as blobs.
 */
import { afterEach as after_each, expect, it, vi } from 'vite-plus/test'
import { is_beside, with_attachments } from '@/utils/vault-attachments'

after_each(() => vi.unstubAllGlobals())

it('knows an image beside the note from one elsewhere', () => {
  expect(is_beside('poster-1.jpg')).toBe(true)
  expect(is_beside('shots/a.png')).toBe(true)
  expect(is_beside('https://example.com/a.png')).toBe(false)
  expect(is_beside('data:image/png;base64,AA')).toBe(false)
  expect(is_beside('/icons.svg')).toBe(false)
  expect(is_beside('')).toBe(false)
})

it('loads each image beside the note with the token, and leaves the rest', async () => {
  const fetch = vi.fn(async () => new Response(new Blob(['x'])))
  vi.stubGlobal('fetch', fetch)
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:one' })
  )
  const { html, urls } = await with_attachments(
    '<p><img src="a.jpg" alt="A"><img src="https://x.test/b.png" alt="B"></p>',
    '/+1555/plans/1',
    'token'
  )
  expect(fetch).toHaveBeenCalledOnce()
  expect(fetch).toHaveBeenCalledWith(
    '/v1/vault/attachment?itemid=%2F%2B1555%2Fplans%2F1&name=a.jpg',
    { headers: { authorization: 'Bearer token' } }
  )
  expect(html).toContain('src="blob:one"')
  expect(html).toContain('src="https://x.test/b.png"')
  expect(urls).toEqual(['blob:one'])
})
