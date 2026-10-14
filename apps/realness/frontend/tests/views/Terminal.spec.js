import { describe, it, expect } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import Terminal from '@/views/Terminal.vue'

describe('@/views/Terminal', () => {
  it('renders the site navigation shell', () => {
    const wrapper = shallowMount(Terminal, {
      global: { stubs: { 'site-nav': true } }
    })

    expect(wrapper.find('site-nav-stub').exists()).toBe(true)
  })
})
