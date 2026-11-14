import {
  afterEach as after_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'
import {
  enableAutoUnmount as enable_auto_unmount,
  flushPromises as flush_promises,
  mount
} from '@vue/test-utils'

vi.mock('@/utils/serverless', async () => {
  const { ref } = await import('vue')
  return { current_user: ref(null) }
})

import Blog from '@/views/Blog.vue'

enable_auto_unmount(after_each)

const ARTICLES = [
  {
    itemid: '/+1555/articles/2',
    path: 'Areas/Blog/Two.md',
    title: 'Two',
    created: '2026-01-01',
    description: 'The newer one'
  },
  {
    itemid: '/+1555/articles/1',
    path: 'Areas/Blog/One.md',
    title: 'One',
    created: '2024-01-01',
    description: ''
  }
]

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

const at_page = () =>
  mount(Blog, { global: { stubs: { 'router-link': router_link_stub } } })

after_each(() => vi.unstubAllGlobals())

describe('@/views/Blog', () => {
  it('lists articles with their date and opens each at its itemid', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ articles: ARTICLES })
    }))
    vi.stubGlobal('fetch', fetch)
    const page = at_page()
    await flush_promises()
    expect(fetch).toHaveBeenCalledWith('/v1/vault/articles', { headers: {} })
    const rows = page.findAll('li')
    expect(rows.map(row => row.get('[itemprop="headline"]').text())).toEqual([
      'Two',
      'One'
    ])
    expect(rows[0].get('a').attributes('href')).toBe('/vault#/+1555/articles/2')
    expect(rows[0].get('time').attributes('datetime')).toBe('2026-01-01')
    expect(rows[0].text()).toContain('The newer one')
    expect(rows[1].find('[itemprop="description"]').exists()).toBe(false)
  })

  it('says so when no article is there', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ articles: [] })
      }))
    )
    const page = at_page()
    await flush_promises()
    expect(page.text()).toContain('No articles yet.')
  })

  it('says so when the vault will not answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    )
    const page = at_page()
    await flush_promises()
    expect(page.text()).toContain('Your articles could not load.')
  })
})
