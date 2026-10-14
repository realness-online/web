import { describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import Terminal from '@/views/Terminal.vue'

describe('Terminal', () => {
  it('shows the site navigation; the workspace draws the terminal', () => {
    const page = mount(Terminal, { global: { stubs: { SiteNav: true } } })
    expect(page.findComponent({ name: 'SiteNav' }).exists()).toBe(true)
  })
})
