import { describe, it, expect } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import CallToAction from '@/components/call-to-action.vue'

describe('@/components/call-to-action', () => {
  it('renders the support aside', () => {
    const wrapper = mount(CallToAction)

    expect(wrapper.find('aside[data-call-to-action]').exists()).toBe(true)
    expect(wrapper.find('h3').text()).toContain('Support')
  })

  it('links the realness wordmark to pricing', () => {
    const wrapper = mount(CallToAction)

    expect(wrapper.find('router-link-stub').attributes('to')).toBe(
      '/pricing'
    )
  })

  it('carries the medium-is-the-message line', () => {
    const wrapper = mount(CallToAction)

    expect(wrapper.find('p strong').text()).toBe('The medium is the message')
  })
})
