import { describe, it, expect } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import PreviewMark from '@/components/colors/preview-mark.vue'

describe('@/components/colors/preview-mark', () => {
  it('labels the button with the icon it previews', () => {
    const wrapper = mount(PreviewMark, {
      props: { name: 'galaxy', label: 'role' }
    })

    expect(wrapper.find('button').attributes('aria-label')).toBe(
      'Preview role with icon: galaxy, click to cycle'
    )
    expect(wrapper.find('small').text()).toBe('galaxy')
  })

  it('falls back to the icon label word', () => {
    const wrapper = mount(PreviewMark, { props: { name: 'gear' } })

    expect(wrapper.find('button').attributes('aria-label')).toContain(
      'icon: gear'
    )
  })

  it('asks for the next icon when clicked', async () => {
    const wrapper = mount(PreviewMark, { props: { name: 'gear' } })

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('cycle')).toHaveLength(1)
  })
})
