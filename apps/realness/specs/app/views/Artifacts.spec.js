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

import Artifacts from '@/views/Artifacts.vue'

enable_auto_unmount(after_each)
after_each(() => vi.unstubAllGlobals())

const ROOT = {
  files: [
    { path: 'plans', name: 'plans', kind: 'folder', size: 0, mtime_ms: 1 },
    {
      path: 'notes.md',
      name: 'notes.md',
      kind: 'file',
      size: 2048,
      mtime_ms: 2
    }
  ]
}

const INNER = {
  files: [
    { path: 'plans/a.md', name: 'a.md', kind: 'file', size: 12, mtime_ms: 3 }
  ]
}

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

const answering = map => {
  const spy = vi.fn(async path => {
    const key = path.includes('folder=')
      ? path.split('folder=')[1]
      : path.split('path=')[1]
    const body = map[decodeURIComponent(key ?? '')] ?? map['']
    return {
      ok: Boolean(body),
      status: body ? 200 : 404,
      json: async () => body
    }
  })
  vi.stubGlobal('fetch', spy)
  return spy
}

describe('@/views/Artifacts', () => {
  it('lists the root folder: folders first, then files with their size', async () => {
    const fetch = answering({ '': ROOT })
    const page = mount(Artifacts, {
      global: { stubs: { 'router-link': router_link_stub } }
    })
    await flush_promises()
    expect(fetch).toHaveBeenCalledWith('/v1/vault/artifacts?folder=', {
      headers: {}
    })
    const items = page.findAll('li')
    expect(items.map(item => item.text())).toEqual([
      expect.stringContaining('plans'),
      expect.stringContaining('2 KB')
    ])
    expect(page.get('code').text()).toBe('artifacts')
  })

  it('opens a folder, then a file, then goes back up', async () => {
    answering({
      '': ROOT,
      plans: INNER,
      'plans/a.md': { path: 'plans/a.md', text: '# A\n' }
    })
    const page = mount(Artifacts, {
      global: { stubs: { 'router-link': router_link_stub } }
    })
    await flush_promises()
    await page.findAll('li button')[0].trigger('click')
    await flush_promises()
    expect(page.get('code').text()).toBe('plans')
    expect(page.findAll('li').map(item => item.text())).toEqual([
      expect.stringContaining('a.md')
    ])
    await page.get('li button').trigger('click')
    await flush_promises()
    expect(page.get('section[aria-label="File"]').text()).toContain('# A')
    expect(page.get('section[aria-label="File"] pre').text()).toBe('# A')
    await page.get('p[aria-label="Folder"] button').trigger('click')
    await flush_promises()
    expect(page.get('code').text()).toBe('artifacts')
  })

  it('says an empty folder is empty', async () => {
    answering({ '': ROOT, plans: { files: [] } })
    const page = mount(Artifacts, {
      global: { stubs: { 'router-link': router_link_stub } }
    })
    await flush_promises()
    await page.findAll('li button')[0].trigger('click')
    await flush_promises()
    expect(page.get('p[role="status"]').text()).toBe('This folder is empty.')
  })

  it('says so when the files cannot load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 }))
    )
    const page = mount(Artifacts, {
      global: { stubs: { 'router-link': router_link_stub } }
    })
    await flush_promises()
    expect(page.get('p[role="status"]').text()).toBe(
      'Your artifacts could not load.'
    )
  })
})
