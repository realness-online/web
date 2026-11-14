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

import Tools from '@/views/Tools.vue'

enable_auto_unmount(after_each)

const PAGES = [
  {
    title: 'Realness backend architecture',
    path: 'Areas/Realness/pages/architecture.html'
  },
  { title: 'Every command', path: 'Areas/Realness/pages/commands.html' }
]

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

const at_page = () =>
  mount(Tools, { global: { stubs: { 'router-link': router_link_stub } } })

after_each(() => vi.unstubAllGlobals())

describe('@/views/Tools', () => {
  it('lists each tool page and opens it by its vault path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ pages: PAGES })
      }))
    )
    const page = at_page()
    await flush_promises()
    const rows = page.findAll('li')
    expect(rows.map(row => row.get('[itemprop="name"]').text())).toEqual([
      'Realness backend architecture',
      'Every command'
    ])
    expect(rows[1].get('a').attributes('href')).toBe(
      '/planning/page#Areas/Realness/pages/commands.html'
    )
  })

  it('says when there is none, and when the vault will not answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ pages: [] })
      }))
    )
    const empty = at_page()
    await flush_promises()
    expect(empty.text()).toContain('No tool pages yet.')

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    )
    const failed = at_page()
    await flush_promises()
    expect(failed.text()).toContain('Your tool pages could not load.')
  })
})
