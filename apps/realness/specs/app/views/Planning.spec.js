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

vi.mock('@/utils/diagrams', () => ({
  draw_diagrams: vi.fn(async () => {}),
  mark_diagrams: vi.fn()
}))

import Planning from '@/views/Planning.vue'

enable_auto_unmount(after_each)

const PLANS = [
  {
    itemid: '/+1555/plans/1',
    path: 'Projects/realness-hosting.md',
    title: 'Hosting',
    area: 'Realness',
    diagram: 'flowchart LR',
    nodes: { open: 2, done: 1, active: [], blocked: ['hs10'] }
  },
  {
    itemid: '/+1555/plans/2',
    path: 'Projects/seeq-leads/index.md',
    title: 'SEEQ leads',
    area: 'SEEQ',
    diagram: null,
    nodes: { open: 5, done: 0, active: [], blocked: [] }
  }
]

const respond = (plans = PLANS) => {
  const spy = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ plans })
  }))
  vi.stubGlobal('fetch', spy)
  return spy
}

const at = search => vi.stubGlobal('location', { search })

after_each(() => vi.unstubAllGlobals())

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

const at_page = () =>
  mount(Planning, { global: { stubs: { 'router-link': router_link_stub } } })

describe('@/views/Planning', () => {
  it('lists every plan with its area and open nodes', async () => {
    at('')
    const fetch = respond()
    const page = at_page()
    await flush_promises()
    expect(fetch).toHaveBeenCalledWith('/v1/vault/plans', { headers: {} })
    const rows = page.findAll('li')
    expect(rows.map(row => row.get('[itemprop="headline"]').text())).toEqual([
      'Hosting',
      'SEEQ leads'
    ])
    expect(rows[0].text()).toContain('2 open')
    expect(rows[0].text()).toContain('hs10 blocked')
    expect(rows[0].get('a').attributes('href')).toBe('/vault#/+1555/plans/1')
    expect(rows[0].get('pre.mermaid').text()).toBe('flowchart LR')
    expect(rows[1].find('pre.mermaid').exists()).toBe(false)
  })

  it('narrows to one area from the address', async () => {
    at('?area=SEEQ')
    respond()
    const page = at_page()
    await flush_promises()
    expect(page.findAll('li').map(row => row.text())).toEqual([
      expect.stringContaining('SEEQ leads')
    ])
    expect(
      page
        .get('nav[aria-label="Areas"]')
        .findAll('a')
        .map(a => a.text())
    ).toEqual(['Realness', 'SEEQ'])
  })

  it('says so when the vault will not answer', async () => {
    at('')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    )
    const page = at_page()
    await flush_promises()
    expect(page.text()).toContain('Your plans could not load.')
  })
})
