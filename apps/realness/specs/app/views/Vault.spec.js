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
  markdown_html: text => `<h1>${text}</h1>`
}))

import Vault from '@/views/Vault.vue'

enable_auto_unmount(after_each)

const at = hash => {
  vi.stubGlobal('location', { hash })
}

const respond = () => {
  const spy = vi.fn(async () => ({
    status: 200,
    ok: true,
    json: async () => ({ path: 'plan.md', title: 'Plan', text: 'Plan' })
  }))
  vi.stubGlobal('fetch', spy)
  return spy
}

after_each(() => vi.unstubAllGlobals())

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

const at_page = () =>
  mount(Vault, { global: { stubs: { 'router-link': router_link_stub } } })

describe('@/views/Vault', () => {
  it('reads a public key and draws the note in its own header', async () => {
    at('#olxW625le8JL7L-NKakKIw')
    const fetch = respond()
    const page = at_page()
    await flush_promises()
    expect(fetch).toHaveBeenCalledWith(
      '/v1/vault/find?key=olxW625le8JL7L-NKakKIw',
      { headers: {} }
    )
    expect(page.get('header h1').text()).toBe('Realness')
    expect(page.get('header p').text()).toBe('Vault')
    expect(page.get('section[itemprop="articleBody"] h1').text()).toBe('Plan')
    expect(page.find('nav').exists()).toBe(false)
  })

  it('asks the owner to sign in for an itemid link', async () => {
    at('#/+16282281824/plans/1785887078791')
    const fetch = respond()
    const page = mount(Vault)
    await flush_promises()
    expect(page.text()).toContain('Sign in to open this link.')
    expect(fetch).not.toHaveBeenCalled()
  })
})
