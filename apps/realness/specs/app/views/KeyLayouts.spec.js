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

import KeyLayouts from '@/views/KeyLayouts.vue'

enable_auto_unmount(after_each)
after_each(() => vi.unstubAllGlobals())

const KEYS = {
  rows: ['`1', 'qw'],
  layouts: {
    leader_direct: {
      '`': ['chat', 'Chat in/out'],
      1: ['go', 'Thoughts'],
      ' ': ['app', 'Open keys panel'],
      q: ['view', '3D'],
      w: ['view', 'Storytelling']
    },
    leader: {
      q: ['view', '3D'],
      w: ['view', 'Storytelling']
    },
    terminal_ctrl: { q: ['terminal', 'Line start'] }
  },
  panel_on: ['q'],
  pi_reserved: ['w'],
  pi_windows: [],
  page: {
    title: 'Key layouts',
    description: 'The selected leader layout.',
    legend: [
      { label: 'View', group: 'view' },
      { label: 'Pi uses Alt+key', reserved: 'pi' }
    ],
    notes: ['Direct shortcuts first.'],
    sections: [
      {
        id: 'leader',
        title: 'One leader key',
        figures: [
          {
            map: 'leader_direct',
            panel: false,
            caption: 'Option+Space opens the panel.'
          },
          { map: 'leader', panel: false, caption: 'Bare keys work.' }
        ],
        terms: [
          { term: 'Keeps', detail: 'Poster settings keep their positions.' }
        ]
      }
    ]
  }
}

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

const at_page = (body = { keys: KEYS }) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => body }))
  )
  return mount(KeyLayouts, {
    global: { stubs: { 'router-link': router_link_stub } }
  })
}

describe('@/views/KeyLayouts', () => {
  it('draws each figure from its map, with the page prose around it', async () => {
    const page = at_page()
    await flush_promises()
    expect(page.text()).toContain('The selected leader layout.')
    expect(page.text()).toContain('Option+Space opens the panel.')
    const boards = page.findAll('figure > ol')
    expect(boards.length).toBe(2)
    const first = boards[0]
    expect(first.findAll(':scope > li').length).toBe(3)
    expect(first.find('kbd').text()).toBe('`')
    expect(first.find('li[data-group="chat"]').exists()).toBe(true)
    expect(boards[1].find('li[data-group="view"]').text()).toContain('3D')
  })

  it('marks the Pi collisions on the direct map only', async () => {
    const page = at_page()
    await flush_promises()
    const boards = page.findAll('figure > ol')
    expect(boards[0].find('li[data-reserved="pi"]').text()).toContain('W')
    expect(boards[1].find('li[data-reserved]').exists()).toBe(false)
    expect(page.findAll('dl dt').map(dt => dt.text())).toEqual(['Keeps'])
  })

  it('says so when the keys cannot load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 }))
    )
    const page = mount(KeyLayouts, {
      global: { stubs: { 'router-link': router_link_stub } }
    })
    await flush_promises()
    expect(page.get('p[role="status"]').text()).toBe(
      'Your key layouts could not load.'
    )
  })
})
