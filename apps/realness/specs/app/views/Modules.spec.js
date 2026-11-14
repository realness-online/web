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

import Modules from '@/views/Modules.vue'

enable_auto_unmount(after_each)
after_each(() => {
  vi.unstubAllGlobals()
  history.replaceState(null, '', '/')
})

const MAP = {
  concerns: ['storage', 'sync'],
  avatars: { scott: 'Scott', odessa: 'Odessa' },
  fates: { keep: 'Clear owner', merge: 'One owner' },
  modules: [
    {
      section: 'Product source',
      id: 'settings',
      name: 'settings',
      sub: 'src/settings',
      owns: 'Paths and policy',
      concerns: ['storage'],
      runs: 'Builds',
      leans: 'Standard library',
      used: 'frontend',
      overlap: 'Shared policy',
      fate: 'keep',
      avatars: ['scott'],
      notes: ['Consolidation is present.']
    },
    {
      section: 'Product source',
      id: 'chat',
      name: 'chat',
      sub: 'src/chat',
      owns: 'Chat',
      concerns: ['sync'],
      runs: 'Browser',
      leans: 'Pi',
      used: 'app',
      overlap: 'None',
      fate: 'merge',
      avatars: ['odessa'],
      notes: ['Shares one session.']
    }
  ],
  patterns: ['One product'],
  questions: ['One status file?']
}

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

const at_page = (body = { map: MAP }) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => body }))
  )
  return mount(Modules, {
    global: { stubs: { 'router-link': router_link_stub } }
  })
}

describe('@/views/Modules', () => {
  it('draws one row per module, under its section', async () => {
    const page = at_page()
    await flush_promises()
    expect(page.findAll('tr.section').map(row => row.text())).toEqual([
      'Product source'
    ])
    expect(page.findAll('tr.row').length).toBe(2)
    expect(page.get('tr.row th').text()).toContain('settings')
    expect(page.text()).toContain('Paths and policy')
    expect(page.findAll('tr.detail').length).toBe(0)
  })

  it('keeps a filter axis and hides the modules it excludes', async () => {
    const page = at_page()
    await flush_promises()
    const concerns = page
      .findAll('fieldset')
      .find(set => set.text().includes('Concern'))
    const sync = concerns
      .findAll('input')
      .find(input => input.element.value === 'sync')
    await sync.setValue(true)
    expect(page.findAll('tr.row').map(row => row.text())).toEqual([
      expect.stringContaining('chat')
    ])
    expect(page.text()).toContain('One status file?')
  })

  it('opens every row at once, and one row on its own', async () => {
    const page = at_page()
    await flush_promises()
    await page.get('input[type="checkbox"]').setValue(true)
    expect(page.findAll('tr.detail').length).toBe(2)
    expect(page.text()).toContain('Shares one session.')
    await page.get('input[type="checkbox"]').setValue(false)
    expect(page.findAll('tr.detail').length).toBe(0)
    await page.get('tr.row th button').trigger('click')
    expect(page.findAll('tr.detail').length).toBe(1)
  })

  it('says so when the map cannot load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 }))
    )
    const page = mount(Modules, {
      global: { stubs: { 'router-link': router_link_stub } }
    })
    await flush_promises()
    expect(page.get('p[role="status"]').text()).toBe(
      'Your modules map could not load.'
    )
  })
})

describe('@/views/Modules link state', () => {
  it('restores filters from the link, and writes changes back to it', async () => {
    history.replaceState(null, '', '/planning/maps/modules?fate=merge')
    const page = at_page({
      map: { ...MAP, decisions: ['Folders separate jobs.'] }
    })
    await flush_promises()
    expect(page.findAll('tr.row').map(row => row.text())).toEqual([
      expect.stringContaining('chat')
    ])
    expect(page.text()).toContain('Folders separate jobs.')
    await page.get('input[type="checkbox"]').setValue(true)
    expect(location.search).toBe('?fate=merge&open=1')
  })
})
