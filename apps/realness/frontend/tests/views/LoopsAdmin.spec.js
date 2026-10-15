import {
  afterEach as after_each,
  beforeEach as before_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'
import { flushPromises as flush_promises, mount } from '@vue/test-utils'

vi.mock('@/utils/serverless', async () => {
  const { ref } = await import('vue')
  return { current_user: ref(null) }
})

import LoopsAdmin from '@/views/LoopsAdmin.vue'
import { current_user } from '@/utils/serverless'
import { read_loop } from '@/utils/loops'

const record = (id, status, started) =>
  `<article itemscope itemtype="/loop"><meta itemprop="id" content="${id}"><meta itemprop="host" content="realness-1"><meta itemprop="owner" content="+14155550123"><meta itemprop="status" content="${status}"><meta itemprop="runs" content="3"><meta itemprop="tokens" content="900"><meta itemprop="started" content="${started}"><p itemprop="goal">faster tests</p></article>`

let files
before_each(() => {
  current_user.value = { getIdToken: async () => 'token' }
  files = {
    'a-00000000000a/record.html': record(
      'a-00000000000a',
      'stopped',
      '2026-09-28T02:00:00Z'
    ),
    'a-00000000000b/record.html': record(
      'a-00000000000b',
      'running',
      '2026-09-28T01:00:00Z'
    )
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      const key = url.replace('/v1/loops/', '')
      if (key === '?deep')
        return new Response(
          JSON.stringify(
            Object.fromEntries(Object.keys(files).map(k => [k, '1']))
          )
        )
      if (init.method === 'PUT')
        return ((files[key] = init.body), new Response('', { status: 200 }))
      return new Response(files[key])
    })
  )
})

after_each(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('loops admin page', () => {
  it('reads a /loop item', () => {
    expect(read_loop(record('a-00000000000a', 'running', 'x'))).toMatchObject({
      id: 'a-00000000000a',
      owner: '+14155550123',
      goal: 'faster tests'
    })
  })

  it('lists every loop, running first, and stops one', async () => {
    const page = mount(LoopsAdmin)
    await flush_promises()
    const rows = page.findAll('tbody tr')
    expect(rows.map(row => row.find('th').text())).toEqual([
      'a-00000000000b',
      'a-00000000000a'
    ])
    expect(rows[1].find('button').exists()).toBe(false)
    await rows[0].find('button').trigger('click')
    await flush_promises()
    expect(files['a-00000000000b/stop.html']).toMatch(/Stop requested/)
    expect(page.find('tbody tr button').text()).toBe('Stopping')
    expect(page.find('tbody tr button').attributes('disabled')).toBeDefined()
    expect(page.find('tbody tr output').text()).toBe('30s')
  })

  it('counts down while stopping and clears when the host reports stopped', async () => {
    vi.useFakeTimers()
    try {
      const page = mount(LoopsAdmin)
      await flush_promises()
      await page.find('tbody tr button').trigger('click')
      await flush_promises()
      expect(page.find('tbody tr output').text()).toBe('30s')

      await vi.advanceTimersByTimeAsync(1000)
      expect(page.find('tbody tr output').text()).toBe('29s')

      files['a-00000000000b/record.html'] = record(
        'a-00000000000b',
        'stopped',
        '2026-09-28T01:00:00Z'
      )
      await vi.advanceTimersByTimeAsync(5000)
      await flush_promises()
      expect(page.find('tbody tr output').exists()).toBe(false)
      expect(page.find('tbody tr button').exists()).toBe(false)
      page.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('says so when the number is not an admin', async () => {
    fetch.mockImplementation(async () => new Response('', { status: 403 }))
    const page = mount(LoopsAdmin)
    await flush_promises()
    expect(page.find('[role=alert]').text()).toBe(
      'This number is not a Realness admin. Ask an admin to run: realness <environment> admins add <your phone> --yes'
    )
  })
})
