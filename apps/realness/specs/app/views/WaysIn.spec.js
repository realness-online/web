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

import WaysIn from '@/views/WaysIn.vue'

enable_auto_unmount(after_each)
after_each(() => {
  vi.unstubAllGlobals()
  history.replaceState(null, '', '/')
})

const MAP = {
  columns: [
    ['identity', 'Identity'],
    ['signin', 'Sign in']
  ],
  avatars: [
    {
      id: 'scott',
      name: 'Scott',
      kind: 'Person',
      about: 'Operates the hosts.',
      needs: ['Sync'],
      risks: ['One keychain entry']
    },
    {
      id: 'solo',
      name: 'Solo tinkerer',
      kind: 'Person',
      about: 'Never joined.',
      needs: ['Local only'],
      risks: []
    }
  ],
  rows: [
    {
      section: 'Solo',
      id: 'solo-terminal',
      name: 'Own terminal',
      sub: 'never joined',
      avatars: ['solo', 'scott'],
      identity: ['none', 'None'],
      signin: ['works', 'Never'],
      notes: ['Local work needs no account.']
    },
    {
      section: 'Cloud',
      id: 'hosted-vm',
      name: 'Hosted VM',
      sub: 'our hosts',
      avatars: ['scott'],
      identity: ['works', 'Host pass'],
      signin: ['gap', 'Text code'],
      notes: ['A parked host needs an operator.']
    }
  ],
  patterns: ['One product'],
  questions: ['Roles?'],
  statuses: ['works', 'gap', 'none']
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
  return mount(WaysIn, {
    global: { stubs: { 'router-link': router_link_stub } }
  })
}

describe('@/views/WaysIn', () => {
  it('draws a row per way in, with one cell per column', async () => {
    const page = at_page()
    await flush_promises()
    expect(page.findAll('thead th').map(th => th.text())).toEqual([
      'Way in',
      'Identity',
      'Sign in'
    ])
    const rows = page.findAll('tr.row')
    expect(rows.length).toBe(2)
    expect(rows[0].findAll('td').map(td => td.text())).toEqual([
      'None',
      'Never'
    ])
    expect(rows[0].find('td').attributes('data-status')).toBe('none')
  })

  it('narrows the table to one avatar and shows that profile', async () => {
    const page = at_page()
    await flush_promises()
    const radios = page.findAll('input[name="avatar"]')
    await radios.find(input => input.element.value === 'solo').setValue(true)
    expect(page.findAll('tr.row').map(row => row.text())).toEqual([
      expect.stringContaining('Own terminal')
    ])
    const profile = page.get('aside')
    expect(profile.text()).toContain('Solo tinkerer')
    expect(profile.text()).toContain('Local only')
    expect(profile.find('dt').text()).toBe('Needs')
  })

  it('hides a section when its box is cleared, and dims cells off the highlight', async () => {
    const page = at_page()
    await flush_promises()
    const cloud = page
      .findAll('input[type="checkbox"]')
      .find(input => input.element.value === 'Cloud')
    await cloud.setValue(false)
    expect(page.findAll('tr.row').length).toBe(1)
    await cloud.setValue(true)
    const gap = page
      .findAll('input[type="radio"]')
      .find(input => input.element.value === 'gap')
    await gap.setValue(true)
    expect(page.findAll('td.dim').length).toBe(3)
  })

  it('opens a row to its notes and avatars', async () => {
    const page = at_page()
    await flush_promises()
    await page.get('tr.row th button').trigger('click')
    const detail = page.get('tr.detail')
    expect(detail.text()).toContain('Local work needs no account.')
    expect(detail.text()).toContain('Solo tinkerer, Scott')
  })

  it('says so when the map cannot load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false }))
    )
    const page = mount(WaysIn, {
      global: { stubs: { 'router-link': router_link_stub } }
    })
    await flush_promises()
    expect(page.get('p[role="status"]').text()).toBe(
      'Your ways in map could not load.'
    )
  })
})

describe('@/views/WaysIn link state', () => {
  it('restores filters from the link, and writes changes back to it', async () => {
    history.replaceState(
      null,
      '',
      '/planning/maps/ways-in?avatar=solo&section=Solo&open=1'
    )
    const page = at_page()
    await flush_promises()
    expect(page.get('aside').text()).toContain('Solo tinkerer')
    expect(page.findAll('tr.row').length).toBe(1)
    expect(page.findAll('tr.detail').length).toBe(1)
    await page
      .findAll('input[type="radio"]')
      .find(input => input.element.value === 'gap')
      .setValue(true)
    expect(new URLSearchParams(location.search).get('highlight')).toBe('gap')
    expect(new URLSearchParams(location.search).get('section')).toBe('Solo')
  })

  it('shows the page prose from the vault', async () => {
    const page = at_page({
      map: {
        ...MAP,
        intro: 'Ways into Realness.',
        glossary: [{ term: 'Circle', detail: 'Who can see.' }],
        decisions: ['One sign-on flow.']
      }
    })
    await flush_promises()
    expect(page.text()).toContain('Ways into Realness.')
    expect(page.get('section[aria-label="About"] dt').text()).toBe('Circle')
    expect(page.text()).toContain('One sign-on flow.')
  })
})
