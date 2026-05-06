import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import AsSponsor from '@/components/account/as-sponsor.vue'

const { mock_sponsorships, mock_is_sponsor, mock_latest } = vi.hoisted(() => {
  const create_ref = value => ({ value, __v_isRef: true })
  return {
    mock_sponsorships: create_ref([]),
    mock_is_sponsor: create_ref(false),
    mock_latest: create_ref(null)
  }
})

vi.mock('@/use/sponsor', () => ({
  use_sponsor: () => ({
    sponsorships: mock_sponsorships,
    is_sponsor: mock_is_sponsor,
    latest_sponsorship: mock_latest,
    record_session: vi.fn()
  })
}))

describe('@/components/account/as-sponsor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_sponsorships.value = []
    mock_is_sponsor.value = false
    mock_latest.value = null
  })

  it('renders the sponsor cta', () => {
    const wrapper = shallowMount(AsSponsor)
    expect(wrapper.find('sponsor-cta-stub').exists()).toBe(true)
  })

  it('shows a thank-you message when the user has sponsored', () => {
    mock_is_sponsor.value = true
    mock_latest.value = { at: '2026-05-04T00:00:00.000Z', session: 'cs_a' }
    const wrapper = shallowMount(AsSponsor)
    expect(wrapper.find('time').exists()).toBe(true)
    expect(wrapper.text()).toContain('Thank you')
  })

  it('uses non-sponsor state when not yet a sponsor', () => {
    const wrapper = shallowMount(AsSponsor)
    expect(wrapper.find('time').exists()).toBe(false)
    expect(wrapper.text()).toContain('Payment is honor system')
  })
})
