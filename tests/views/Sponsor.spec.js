import { describe, it, expect } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import Sponsor from '@/views/Sponsor.vue'

describe('@/views/Sponsor', () => {
  it('renders the sponsor page with cta', () => {
    const wrapper = shallowMount(Sponsor, {
      global: {
        stubs: {
          'logo-as-link': true,
          'sponsor-cta': true
        }
      }
    })
    expect(wrapper.find('section#sponsor-page.page').exists()).toBe(true)
    expect(wrapper.text()).toContain('Sponsor')
    expect(wrapper.text()).toContain('Realness is independent')
    expect(wrapper.find('sponsor-cta-stub').exists()).toBe(true)
  })
})
