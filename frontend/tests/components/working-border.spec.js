import { describe, it, expect } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import WorkingBorder from '@/components/working-border.vue'

describe('@/components/working-border', () => {
  it('renders inactive by default', () => {
    const wrapper = shallowMount(WorkingBorder)
    expect(
      wrapper.find('div.working-border').attributes('data-active')
    ).toBeUndefined()
    expect(wrapper.find('div.working-border > div').exists()).toBe(true)
  })

  it('adds data-active when active is true', () => {
    const wrapper = shallowMount(WorkingBorder, {
      props: { active: true }
    })
    expect(wrapper.find('div.working-border').attributes('data-active')).toBe(
      'true'
    )
  })
})
