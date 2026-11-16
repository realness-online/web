import { readFileSync as read_file_sync } from 'node:fs'
import { join } from 'node:path'
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
  draw_diagrams: vi.fn(async () => []),
  hide_until_drawn: vi.fn(),
  reveal_diagrams: vi.fn()
}))

import Planning from '@/views/Planning.vue'
import { current_user } from '@/utils/serverless'
import {
  draw_diagrams,
  hide_until_drawn,
  reveal_diagrams
} from '@/utils/diagrams'

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

const COUNTS = [
  {
    itemid: '/+1555/plans/none',
    title: 'Empty plan',
    area: 'Realness',
    diagram: null,
    nodes: { open: 0, done: 0, active: [], blocked: [] }
  },
  {
    itemid: '/+1555/plans/done',
    title: 'Finished plan',
    area: 'Realness',
    diagram: null,
    nodes: { open: 0, done: 4, active: [], blocked: [] }
  },
  {
    itemid: '/+1555/plans/close',
    title: 'Nearly there',
    area: 'Realness',
    diagram: null,
    nodes: { open: 1, done: 3, active: [], blocked: [] }
  },
  {
    itemid: '/+1555/plans/many',
    title: 'Big plan',
    area: 'SEEQ',
    diagram: null,
    nodes: { open: 8, done: 4, active: [], blocked: [] }
  },
  {
    itemid: '/+1555/plans/mid',
    title: 'Halfway',
    area: 'SEEQ',
    diagram: null,
    nodes: { open: 5, done: 3, active: [], blocked: [] }
  },
  {
    itemid: '/+1555/plans/stuck',
    title: 'Stuck plan',
    area: 'SEEQ',
    diagram: null,
    nodes: { open: 3, done: 1, active: [], blocked: ['hs10'] }
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

const at = search =>
  vi.stubGlobal('location', { search, pathname: '/planning' })

after_each(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

const at_page = () =>
  mount(Planning, { global: { stubs: { 'router-link': router_link_stub } } })

describe('@/views/Planning', () => {
  it('draws each plan as the old cover: a figure holding its diagram, then its title', async () => {
    at('')
    const fetch = respond()
    const page = at_page()
    await flush_promises()
    expect(fetch).toHaveBeenCalledWith('/v1/vault/plans', { headers: {} })
    const covers = page.findAll('section > article')
    expect(covers.length).toBe(2)
    expect(
      covers.map(cover => cover.get('[itemprop="headline"]').text())
    ).toEqual(['Hosting', 'SEEQ leads'])
    expect(covers[0].get('figure > pre.mermaid').text()).toBe('flowchart LR')
    expect(covers[0].get('[itemprop="headline"]').element.tagName).toBe('H3')
    expect(covers[0].get('[itemprop="url"]').attributes('href')).toBe(
      '/vault#/+1555/plans/1'
    )
    expect(covers[0].get('[itemprop="genre"]').text()).toBe('Realness')
    expect(covers[0].attributes('data-area')).toBe('Realness')
    expect(covers[0].text()).toContain('2')
    expect(covers[0].text()).toContain('hs10')
    expect(covers[1].find('pre.mermaid').exists()).toBe(false)
  })

  it('tiles the covers on the thoughts grid', () => {
    const view = read_file_sync(
      join(import.meta.dirname, '../../../src/app/views/Planning.vue'),
      'utf8'
    )
    const style = view.slice(view.indexOf('<style lang="stylus">'))
    expect(style).toMatch(/> section \{[^}]*standard-grid/)
    expect(style).toMatch(/> article \{[^}]*display: grid/)
    expect(style).toMatch(/&\[hidden\] \{\s*display: none/)
    expect(style).toMatch(/&\[aria-pressed='true'\]/)
  })

  it('hands the covers to the drawing step, and hides the page until they draw', async () => {
    at('')
    respond()
    const page = at_page()
    await flush_promises()
    expect(hide_until_drawn).toHaveBeenCalled()
    expect(reveal_diagrams).toHaveBeenCalled()
    const [container] = draw_diagrams.mock.calls[0]
    expect(container.querySelector('pre.mermaid')?.textContent).toBe(
      'flowchart LR'
    )
  })

  it('filters in place from the area pills, and keeps the address in step', async () => {
    at('')
    const replace = vi.spyOn(history, 'replaceState')
    respond()
    const page = at_page()
    await flush_promises()
    const pills = page.get('nav[aria-label="Plans by area"]').findAll('button')
    expect(pills.map(pill => pill.text())).toEqual(['All', 'Realness', 'SEEQ'])
    expect(pills[0].attributes('aria-pressed')).toBe('true')
    await pills[2].trigger('click')
    const covers = page.findAll('section > article')
    expect(covers[0].attributes('hidden')).toBeDefined()
    expect(covers[1].attributes('hidden')).toBeUndefined()
    expect(pills[2].attributes('aria-pressed')).toBe('true')
    expect(replace).toHaveBeenCalledWith(null, '', '/planning?area=SEEQ')
  })

  it('waits for a restored sign-in, then asks with its token', async () => {
    at('')
    const fetch = respond()
    current_user.value = undefined
    at_page()
    await flush_promises()
    current_user.value = { getIdToken: async () => 'token' }
    await flush_promises()
    expect(fetch).toHaveBeenCalledWith('/v1/vault/plans', {
      headers: { authorization: 'Bearer token' }
    })
    current_user.value = null
  })

  it('narrows to plans by how far along they are', async () => {
    at('')
    respond(COUNTS)
    const page = at_page()
    await flush_promises()
    const nav = page.get('nav[aria-label="Plans by state"]')
    const pills = nav.findAll('button')
    expect(pills.map(pill => pill.text())).toEqual([
      'All',
      'No nodes',
      'Finished',
      'Close to done',
      'Blocked',
      'Many nodes',
      'Scouts'
    ])
    const titles = () =>
      page
        .findAll('section > article')
        .filter(cover => cover.attributes('hidden') === undefined)
        .map(cover => cover.get('[itemprop="headline"]').text())

    await pills[1].trigger('click')
    expect(titles()).toEqual(['Empty plan'])
    await pills[2].trigger('click')
    expect(titles()).toEqual(['Finished plan'])
    await pills[3].trigger('click')
    expect(titles()).toEqual(['Nearly there'])
    await pills[4].trigger('click')
    expect(titles()).toEqual(['Stuck plan'])
    await pills[5].trigger('click')
    expect(titles()).toEqual(['Big plan'])
    await pills[0].trigger('click')
    expect(titles().length).toBe(6)
  })

  it('combines a state with an area, and keeps both in the address', async () => {
    at('')
    respond(COUNTS)
    const page = at_page()
    await flush_promises()
    await page
      .get('nav[aria-label="Plans by state"]')
      .findAll('button')[5]
      .trigger('click')
    await page
      .get('nav[aria-label="Plans by area"]')
      .findAll('button')[1]
      .trigger('click')
    const shown = page
      .findAll('section > article')
      .filter(cover => cover.attributes('hidden') === undefined)
    expect(shown.length).toBe(0)
    at('?state=many&area=SEEQ')
    const second = at_page()
    await flush_promises()
    expect(
      second
        .findAll('section > article')
        .filter(cover => cover.attributes('hidden') === undefined)
        .map(cover => cover.get('[itemprop="headline"]').text())
    ).toEqual(['Big plan'])
  })

  it('opens on the area the address names', async () => {
    at('?area=SEEQ')
    respond()
    const page = at_page()
    await flush_promises()
    const covers = page.findAll('section > article')
    expect(covers[0].attributes('hidden')).toBeDefined()
    expect(covers[1].attributes('hidden')).toBeUndefined()
  })

  it('says so when the vault will not answer, and never stays hidden', async () => {
    at('')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 }))
    )
    const page = at_page()
    await flush_promises()
    expect(page.get('p[role="status"]').text()).toBe(
      'Your plans could not load.'
    )
    expect(reveal_diagrams).toHaveBeenCalled()
  })
})
