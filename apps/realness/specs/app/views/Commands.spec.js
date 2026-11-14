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

import Commands from '@/views/Commands.vue'

enable_auto_unmount(after_each)
after_each(() => vi.unstubAllGlobals())

const GROUPS = [
  {
    name: 'Monitor',
    rows: [
      {
        title: 'Realness watch',
        kind: 'CLI command - Realness',
        review: 'Keep',
        note: 'Live health and spend.',
        command: 'realness watch',
        details: ['Live health.']
      }
    ]
  },
  {
    name: 'Build',
    rows: [
      {
        title: 'build',
        kind: 'npm script - apps/realness',
        review: 'Keep',
        note: 'Build the app.',
        command: 'npm run build',
        details: []
      }
    ]
  }
]

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

const at_page = () =>
  mount(Commands, { global: { stubs: { 'router-link': router_link_stub } } })

const respond = () => {
  const spy = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ groups: GROUPS })
  }))
  vi.stubGlobal('fetch', spy)
  return spy
}

describe('@/views/Commands', () => {
  it('lists every command in its group and counts them', async () => {
    const fetch = respond()
    const page = at_page()
    await flush_promises()
    expect(fetch).toHaveBeenCalledWith('/v1/vault/commands', { headers: {} })
    expect(page.findAll('h2').map(h2 => h2.text())).toEqual([
      'Monitor',
      'Build'
    ])
    expect(page.text()).toContain('realness watch')
    expect(page.get('output').text()).toBe('2 commands')
  })

  it('narrows by the search box and by a task', async () => {
    respond()
    const page = at_page()
    await flush_promises()
    await page.get('input[type="search"]').setValue('npm')
    expect(page.findAll('h2').map(h2 => h2.text())).toEqual(['Build'])
    expect(page.get('output').text()).toBe('1 command')
    await page.get('input[type="search"]').setValue('')
    const tasks = page.findAll('fieldset button')
    expect(tasks.map(button => button.text())).toEqual([
      'All',
      'Monitor',
      'Build'
    ])
    await tasks.find(button => button.text() === 'Monitor').trigger('click')
    expect(page.findAll('h2').map(h2 => h2.text())).toEqual(['Monitor'])
  })
})
