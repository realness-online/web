import { readFileSync } from 'node:fs'
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

vi.mock('@/utils/markdown', () => ({
  markdown_html: text => (text.startsWith('<') ? text : `<h1>${text}</h1>`),
  highlight_code: async html => html
}))

import Vault from '@/views/Vault.vue'
import { current_user } from '@/utils/serverless'

enable_auto_unmount(after_each)

const at = hash => {
  vi.stubGlobal('location', { hash })
}

const respond = (note = {}) => {
  const spy = vi.fn(async () => ({
    status: 200,
    ok: true,
    json: async () => ({
      path: 'plan.md',
      title: 'Plan',
      text: 'Plan',
      ...note
    })
  }))
  vi.stubGlobal('fetch', spy)
  return spy
}

const signed_in = async () => {
  current_user.value = { getIdToken: async () => 'token' }
}

after_each(() => {
  vi.unstubAllGlobals()
  current_user.value = null
})

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

const at_page = () =>
  mount(Vault, { global: { stubs: { 'router-link': router_link_stub } } })

describe('@/views/Vault', () => {
  it('stays in the app for a plan that also has a published copy', async () => {
    const replace = vi.fn()
    vi.stubGlobal('location', {
      hash: '#/+16282281824/plans/1785887078791',
      replace
    })
    respond()
    const page = at_page()
    await flush_promises()
    expect(replace).not.toHaveBeenCalled()
    expect(page.get('section[itemprop="articleBody"] h1').text()).toBe('Plan')
  })

  it('opens an itemid link through the route that asks can', async () => {
    await signed_in()
    at('#/+16282281824/plans/1785887078791')
    const fetch = respond()
    const page = at_page()
    await flush_promises()
    expect(fetch).toHaveBeenCalledWith(
      '/v1/vault/item?itemid=%2F%2B16282281824%2Fplans%2F1785887078791',
      { headers: { authorization: 'Bearer token' } }
    )
    expect(page.get('section[itemprop="articleBody"] h1').text()).toBe('Plan')
  })

  it('shows the note file path, so the file can be found on disk', async () => {
    at('#/+16282281824/plans/1785887078791')
    respond({ path: 'Projects/realness-one-network.md' })
    const page = at_page()
    await flush_promises()
    expect(page.get('footer[aria-label="Note file"] code').text()).toBe(
      'Projects/realness-one-network.md'
    )
  })

  it('lets the file path be selected and copied', async () => {
    const style = readFileSync('src/app/views/Vault.vue', 'utf8')
    expect(style).toMatch(/> code \{\s*user-select: text;/)
  })

  it('aligns table headers with their rows', async () => {
    const style = readFileSync('src/app/views/Vault.vue', 'utf8')
    expect(style).toMatch(/th,\s*td \{[^}]*text-align: start;/)
  })

  it('refuses a stored key, which would skip every right', async () => {
    at('#olxW625le8JL7L-NKakKIw')
    const fetch = respond()
    const page = at_page()
    await flush_promises()
    expect(fetch).not.toHaveBeenCalled()
    expect(page.get('p[role="status"]').text()).toBe('That note is not here.')
  })

  it('opens a plan link for a stranger, who sends no token', async () => {
    at('#/+16282281824/plans/1785887078791')
    const fetch = respond()
    const page = mount(Vault)
    await flush_promises()
    expect(fetch).toHaveBeenCalledWith(
      '/v1/vault/item?itemid=%2F%2B16282281824%2Fplans%2F1785887078791',
      { headers: {} }
    )
    expect(page.get('section[itemprop="articleBody"] h1').text()).toBe('Plan')
  })

  it('names a missing note instead of failing', async () => {
    await signed_in()
    at('#/+16282281824/plans/1799999999999')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ status: 404, ok: false, json: async () => ({}) }))
    )
    const page = at_page()
    await flush_promises()
    expect(page.text()).toContain('That note is not here.')
  })

  it('opens a body link that names another vault note as that note', async () => {
    await signed_in()
    at('#/+16282281824/plans/1785887078791')
    respond({
      text: '<p><a href="a.md">A</a> <a href="https://example.com/a.md">out</a></p>',
      links: { 'a.md': '#/+16282281824/plans/1794248309040' }
    })
    const page = at_page()
    await flush_promises()
    const links = page.get('section[itemprop="articleBody"]').findAll('a')
    expect(links[0].attributes('href')).toBe(
      '#/+16282281824/plans/1794248309040'
    )
    expect(links[1].attributes('href')).toBe('https://example.com/a.md')
  })

  it("shows a signed-in owner the plan's related links", async () => {
    await signed_in()
    at('#/+16282281824/plans/1785887078791')
    respond({
      related: [
        { title: 'Hosting', href: '#/+16282281824/plans/1794248309040' },
        { title: 'Away', href: '../../work/away.md' }
      ]
    })
    const page = at_page()
    await flush_promises()
    const nav = page.get('article nav[aria-label="Related"]')
    const links = nav.findAll('a')
    expect(links.map(link => link.text())).toEqual(['Hosting', 'Away'])
    expect(links[1].attributes('href')).toBe('../../work/away.md')
  })
})
