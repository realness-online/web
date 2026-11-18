/**
 * b3: a blog address in the app shows the article, marked up as the published
 * blog marks it up.
 */
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

const { load_article } = vi.hoisted(() => ({ load_article: vi.fn() }))

vi.mock('@/blog/vault-blog', () => ({ load_article }))

vi.mock('@/utils/settled-user', () => ({ settled_token: async () => null }))

const { mock_params } = vi.hoisted(() => ({
  mock_params: { slug: 'the-harness-is-the-thing' }
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: mock_params })
}))

import Article from '@/views/Article.vue'

enable_auto_unmount(after_each)

const ARTICLE_HTML = `<article itemscope itemid="/+1555/articles/2" itemtype="http://schema.org/BlogPosting">
  <figure style="--ratio: 0.7496"><img src="/v1/poster/p.svg" alt="" loading="lazy">
    <figcaption><h1 itemprop="headline">The Harness Is the Thing</h1>
      <time itemprop="datePublished" datetime="2026-08-25">August 25, 2026</time>
    </figcaption>
  </figure>
  <section itemprop="articleBody"><p>When I started out.</p></section>
</article>`

const respond = ({ html = ARTICLE_HTML, status = 200 } = {}) => {
  if (status === 200) load_article.mockResolvedValue(html)
  else if (status === 404) load_article.mockResolvedValue(null)
  else load_article.mockRejectedValue(new Error(`${status}`))
}

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

const show = () =>
  mount(Article, { global: { stubs: { 'router-link': router_link_stub } } })

describe('@/views/Article', () => {
  after_each(() => {
    load_article.mockReset()
    mock_params.slug = 'the-harness-is-the-thing'
  })

  it('shows the article as the published blog marks it up', async () => {
    respond()
    const page = show()
    await flush_promises()
    expect(load_article).toHaveBeenCalledWith('the-harness-is-the-thing', null)
    const article = page.get('article[itemtype$="BlogPosting"]')
    expect(article.attributes('itemid')).toBe('/+1555/articles/2')
    expect(article.get('[itemprop="headline"]').text()).toBe(
      'The Harness Is the Thing'
    )
    expect(article.get('time').attributes('datetime')).toBe('2026-08-25')
    expect(article.get('figure').attributes('style')).toContain(
      '--ratio: 0.7496'
    )
    expect(article.text()).toContain('When I started out.')
    expect(page.find('p[role="status"]').exists()).toBe(false)
  })

  it('wears the blog header above the article', async () => {
    respond()
    const page = show()
    await flush_promises()
    const header = page.get('header')
    expect(header.get('h1').text()).toBe('Scott Fryxell')
    expect(header.get('p').text()).toBe('Humanist Software Developer')
    expect(header.get('nav a').attributes('href')).toBe('/blog')
  })

  it('says so when no article has that address', async () => {
    respond({ html: '', status: 404 })
    mock_params.slug = 'gone'
    const page = show()
    await flush_promises()
    expect(page.get('p[role="status"]').text()).toBe(
      'That article is not here.'
    )
  })

  it('says so when the article cannot load', async () => {
    respond({ html: '', status: 500 })
    const page = show()
    await flush_promises()
    expect(page.get('p[role="status"]').text()).toBe(
      'Your article could not load.'
    )
  })
})
