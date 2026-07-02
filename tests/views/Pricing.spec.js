import { describe, it, expect } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import Pricing from '@/views/Pricing.vue'

describe('@/views/Pricing', () => {
  it('renders the pricing page with plan cards', () => {
    const wrapper = shallowMount(Pricing, {
      global: {
        stubs: {
          'logo-as-link': true,
          'sponsor-cta': true,
          'as-prompt-agent': true
        }
      }
    })
    expect(wrapper.find('section#pricing.page').exists()).toBe(true)
    expect(wrapper.find('h1').text()).toBe('Pricing')
    expect(wrapper.text()).toContain('Realness is free to use')
    expect(wrapper.text()).toContain('It costs $5, and stays free to use')
    expect(wrapper.findAll('li > article')).toHaveLength(3)
    expect(wrapper.text()).toContain('Free to use')
    expect(wrapper.text()).toContain('Small teams')
    expect(wrapper.text()).toContain('Large organizations')
    expect(wrapper.text()).toContain('Commercial use')
    expect(wrapper.text()).toContain('No per-seat pricing')
    expect(wrapper.text()).toContain('$5')
    expect(wrapper.findAll('sponsor-cta-stub')).toHaveLength(3)
    expect(wrapper.findAll('as-prompt-agent-stub')).toHaveLength(2)
    expect(wrapper.find('section.prompt-agent').exists()).toBe(false)
  })
})
