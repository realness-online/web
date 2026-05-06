import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'

const { mock_me, mock_save } = vi.hoisted(() => ({
  mock_me: { value: undefined, __v_isRef: true },
  mock_save: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/utils/serverless', () => ({
  me: mock_me
}))

vi.mock('@/persistence/Storage', () => ({
  Me: vi.fn(function me_storage_mock() {
    this.save = mock_save
  })
}))

const fresh = async () => {
  vi.resetModules()
  return await import('@/use/sponsor')
}

describe('@/use/sponsor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_save.mockResolvedValue(undefined)
    localStorage.clear()
    localStorage.me = '/+15550000000'
    document.body.innerHTML =
      '<address itemid="/+15550000000"><h3>Scott</h3></address>'
    mock_me.value = { id: '/+15550000000', name: 'Scott' }
  })

  it('exposes empty state when there are no sponsorships', async () => {
    const { use_sponsor } = await fresh()
    const { sponsorships, is_sponsor, latest_sponsorship } = use_sponsor()
    expect(sponsorships.value).toEqual([])
    expect(is_sponsor.value).toBe(false)
    expect(latest_sponsorship.value).toBe(null)
  })

  it('reads an existing single sponsorship from me', async () => {
    mock_me.value = {
      id: '/+15550000000',
      sponsorship: { at: '2026-04-01T00:00:00.000Z', session: 'cs_a' }
    }
    const { use_sponsor } = await fresh()
    const { sponsorships, is_sponsor } = use_sponsor()
    expect(sponsorships.value).toHaveLength(1)
    expect(is_sponsor.value).toBe(true)
  })

  it('sorts sponsorships newest first', async () => {
    mock_me.value = {
      id: '/+15550000000',
      sponsorship: [
        { at: '2026-01-01T00:00:00.000Z', session: 'cs_old' },
        { at: '2026-05-01T00:00:00.000Z', session: 'cs_new' }
      ]
    }
    const { use_sponsor } = await fresh()
    const { latest_sponsorship } = use_sponsor()
    expect(latest_sponsorship.value?.session).toBe('cs_new')
  })

  it('records a new session, mutates me, and persists via Me.save', async () => {
    const { use_sponsor } = await fresh()
    const { record_session } = use_sponsor()
    const added = await record_session('cs_test_abc')
    expect(added).toBe(true)
    const recorded = mock_me.value.sponsorship
    expect(recorded).toHaveLength(1)
    expect(recorded[0].session).toBe('cs_test_abc')
    expect(typeof recorded[0].at).toBe('string')
    expect(mock_save).toHaveBeenCalledTimes(1)
  })

  it('skips duplicate session ids', async () => {
    mock_me.value = {
      id: '/+15550000000',
      sponsorship: [{ at: '2026-04-01T00:00:00.000Z', session: 'cs_dup' }]
    }
    const { use_sponsor } = await fresh()
    const { record_session } = use_sponsor()
    const added = await record_session('cs_dup')
    expect(added).toBe(false)
    expect(mock_save).not.toHaveBeenCalled()
  })

  it('returns false when session_id is empty', async () => {
    const { use_sponsor } = await fresh()
    const { record_session } = use_sponsor()
    expect(await record_session('')).toBe(false)
    expect(mock_save).not.toHaveBeenCalled()
  })

  it('returns false when me is not set', async () => {
    mock_me.value = undefined
    const { use_sponsor } = await fresh()
    const { record_session } = use_sponsor()
    expect(await record_session('cs_x')).toBe(false)
    expect(mock_save).not.toHaveBeenCalled()
  })
})
