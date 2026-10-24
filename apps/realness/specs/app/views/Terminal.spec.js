import { describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import Terminal from '@/views/Terminal.vue'

describe('Terminal', () => {
  it('renders an empty page; the workspace draws the terminal and its header', () => {
    const page = mount(Terminal)
    const section = page.get('section[aria-label="Terminal"]')
    expect(section.attributes('tabindex')).toBe('-1')
    expect(page.find('nav').exists()).toBe(false)
  })
})
