import { describe, it, expect } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import License from '@/views/License.vue'

describe('@/views/License', () => {
  it('renders the license page with plan cards', () => {
    const wrapper = shallowMount(License, {
      global: {
        stubs: {
          'logo-as-link': true,
          'sponsor-cta': true
        }
      }
    })
    expect(wrapper.find('section#pricing-page.page').exists()).toBe(true)
    expect(wrapper.find('h1').text()).toBe('Pricing')
    expect(wrapper.text()).toContain('Realness is free to use')
    expect(wrapper.text()).toContain('It costs $5, and stays free to use')
    expect(wrapper.findAll('article.license-plan')).toHaveLength(3)
    expect(wrapper.text()).toContain('Free to use')
    expect(wrapper.text()).toContain('Small teams')
    expect(wrapper.text()).toContain('Large organizations')
    expect(wrapper.text()).toContain('Checksumable build')
    expect(wrapper.text()).toContain('Mosaics')
    expect(wrapper.text()).toContain('Transparent cutouts')
    expect(wrapper.text()).toContain('No per-seat pricing')
    expect(wrapper.find('sponsor-cta-stub').exists()).toBe(true)
  })
})
