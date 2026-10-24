import {
  afterEach as after_each,
  beforeEach as before_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'
import { flushPromises as flush_promises, mount } from '@vue/test-utils'

const { posters, for_person, load, landscape_posters, ensure_og_fonts } =
  vi.hoisted(() => ({
    posters: { value: [] },
    for_person: vi.fn(async () => {}),
    load: vi.fn(async id => ({ id })),
    landscape_posters: vi.fn(() => []),
    ensure_og_fonts: vi.fn(async () => {})
  }))

vi.mock('@/use/poster', async original => ({
  ...(await original()),
  use_posters: () => ({ posters, for_person })
}))
vi.mock('@/utils/itemid', async original => ({
  ...(await original()),
  load
}))
vi.mock('@/utils/og-candidates', async original => ({
  ...(await original()),
  landscape_posters,
  ensure_og_fonts
}))

const OgCandidates = (await import('@/views/OgCandidates.vue')).default

const open = async () => {
  const page = mount(OgCandidates, { global: { stubs: { AsFigure: true } } })
  await flush_promises()
  return page
}

before_each(() => {
  posters.value = []
  delete window.__og_candidates
  delete window.__og_candidates_done
})
after_each(() => vi.unstubAllEnvs())

describe('OgCandidates', () => {
  it('says what is missing when no admin is configured', async () => {
    vi.stubEnv('VITE_ADMIN_ID', '')
    const page = await open()
    expect(page.get('header p').text()).toBe('VITE_ADMIN_ID is not set')
    expect(window.__og_candidates_done).toBe(true)
    expect(for_person).not.toHaveBeenCalled()
  })

  it('loads the admin posters and reports none when none are landscape', async () => {
    vi.stubEnv('VITE_ADMIN_ID', '/+14151234356')
    posters.value = [{ id: '/+14151234356/posters/1000' }]
    const page = await open()
    expect(for_person).toHaveBeenCalledWith({ id: '/+14151234356' })
    expect(load).toHaveBeenCalledWith('/+14151234356/posters/1000')
    expect(landscape_posters).toHaveBeenCalledWith([
      { id: '/+14151234356/posters/1000' }
    ])
    expect(ensure_og_fonts).toHaveBeenCalled()
    expect(page.get('header p').text()).toBe('0 candidates')
    expect(window.__og_candidates).toEqual([])
    expect(window.__og_candidates_done).toBe(true)
  })
})
