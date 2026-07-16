import { describe, it, expect } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import LogoAsLink from '@/components/logo-as-link.vue'

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

describe('@/components/logo-as-link', () => {
  it('links the realness icon to home', () => {
    const wrapper = shallowMount(LogoAsLink, {
      global: {
        stubs: {
          icon: {
            name: 'icon',
            props: ['name'],
            template: '<svg class="icon" />'
          },
          'router-link': router_link_stub
        }
      }
    })
    const link = wrapper.find('a[aria-label="Realness home"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/')
    expect(wrapper.find('svg.icon').exists()).toBe(true)
  })
})
