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

vi.mock('@/utils/settled-user', () => ({ settled_token: async () => null }))

const { mock_replace, mock_params } = vi.hoisted(() => ({
  mock_replace: vi.fn(),
  mock_params: { slug: 'leads' }
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: mock_params }),
  useRouter: () => ({ replace: mock_replace })
}))

import Article from '@/views/Article.vue'

enable_auto_unmount(after_each)

const ARTICLES = [
  { itemid: '/+1555/articles/2', path: 'Areas/Blog/2026/leads.md' },
  { itemid: '/+1555/articles/1', path: 'Areas/Blog/2026/other.md' }
]

const respond = (articles = ARTICLES, ok = true) => {
  const spy = vi.fn(async () => ({
    ok,
    json: async () => ({ articles })
  }))
  vi.stubGlobal('fetch', spy)
  return spy
}

const show = () => mount(Article)

describe('@/views/Article', () => {
  after_each(() => {
    vi.unstubAllGlobals()
    mock_replace.mockClear()
    mock_params.slug = 'leads'
  })

  it('opens a blog address at the article it names', async () => {
    const fetch = respond()
    show()
    await flush_promises()
    expect(fetch).toHaveBeenCalledWith('/v1/vault/articles', { headers: {} })
    expect(mock_replace).toHaveBeenCalledWith({
      path: '/vault',
      hash: '#/+1555/articles/2'
    })
  })

  it('says so when no article has that address', async () => {
    respond()
    mock_params.slug = 'gone'
    const page = show()
    await flush_promises()
    expect(mock_replace).not.toHaveBeenCalled()
    expect(page.text()).toBe('That article is not here.')
  })

  it('says so when the articles cannot load', async () => {
    respond([], false)
    const page = show()
    await flush_promises()
    expect(page.text()).toBe('Your articles could not load.')
  })
})
