/**
 * b4: the blog index in the app is the published blog's own markup.
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

const { load_blog } = vi.hoisted(() => ({ load_blog: vi.fn() }))

vi.mock('@/blog/vault-blog', () => ({ load_blog }))

vi.mock('@/utils/settled-user', () => ({ settled_token: async () => null }))

vi.mock('@/utils/serverless', async () => {
  const { ref } = await import('vue')
  return { current_user: ref(null) }
})

import Blog from '@/views/Blog.vue'

enable_auto_unmount(after_each)

const INDEX_HTML = `<section>
  <article itemid="/+1555/articles/2" itemscope itemtype="http://schema.org/BlogPosting">
    <details>
      <summary>
        <figure><img src="/posters/p.svg" alt="" loading="lazy">
          <figcaption><h2 itemprop="headline"><a itemprop="url" href="/blog/two">Two</a></h2>
            <time itemprop="datePublished" datetime="2026-01-01">January 1, 2026</time>
          </figcaption>
        </figure>
      </summary>
      <section itemprop="articleBody"><p>Body of Two.</p></section>
    </details>
  </article>
</section>`

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

const at_page = () =>
  mount(Blog, {
    global: {
      stubs: {
        'router-link': router_link_stub,
        AsPosterPicker: {
          props: ['choices'],
          template: '<aside aria-label="Your posters"></aside>'
        }
      }
    }
  })

const shows = html => load_blog.mockResolvedValue(html)

after_each(() => load_blog.mockReset())

describe('@/views/Blog', () => {
  it('shows the renderer index: posters, dates, and each article link', async () => {
    shows(INDEX_HTML)
    const page = at_page()
    await flush_promises()
    expect(load_blog).toHaveBeenCalledWith(null)
    const rows = page.findAll('article[itemtype$="BlogPosting"]')
    expect(rows).toHaveLength(1)
    expect(rows[0].attributes('itemid')).toBe('/+1555/articles/2')
    expect(rows[0].get('[itemprop="headline"] a').attributes('href')).toBe(
      '/blog/two'
    )
    expect(rows[0].get('img').attributes('src')).toBe('/posters/p.svg')
    expect(rows[0].get('time').attributes('datetime')).toBe('2026-01-01')
    expect(rows[0].text()).toContain('Body of Two.')
  })

  it('wears the blog header: name, tagline, and Thoughts', async () => {
    shows(INDEX_HTML)
    const page = at_page()
    await flush_promises()
    const header = page.get('header')
    expect(header.get('h1').text()).toBe('Scott Fryxell')
    expect(header.get('p').text()).toBe('Humanist Software Developer')
    expect(header.get('nav a').text()).toBe('Thoughts')
    expect(header.get('nav a').attributes('href')).toBe('/blog')
  })

  it('opens the poster panel from a card with no poster', async () => {
    const index = INDEX_HTML.replace(
      '<img src="/posters/p.svg" alt="" loading="lazy">',
      '<button type="button" class="pick-poster" aria-label="Add a poster"></button>'
    )
    shows(index)
    const page = at_page()
    await flush_promises()
    expect(page.find('aside[aria-label="Your posters"]').exists()).toBe(false)
    await page.get('button.pick-poster').trigger('click')
    expect(page.find('aside[aria-label="Your posters"]').exists()).toBe(true)
  })

  it('says so when the index cannot load', async () => {
    load_blog.mockRejectedValue(new Error('404'))
    const page = at_page()
    await flush_promises()
    expect(page.get('p[role="status"]').text()).toBe(
      'Your articles could not load.'
    )
  })

  it('says so when there are no articles', async () => {
    shows('')
    const page = at_page()
    await flush_promises()
    expect(page.get('p[role="status"]').text()).toBe('No articles yet.')
  })
})
