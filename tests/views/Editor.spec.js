import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Editor from '@/views/Editor'

describe('@/views/Editor', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = shallowMount(Editor)
  })

  it('renders editor component', () => {
    expect(wrapper.element).toMatchSnapshot()
  })

  it('handles content updates', () => {
    const test_content = 'test content'
    wrapper.vm.update_content(test_content)
    expect(wrapper.vm.content).toBe(test_content)
  })
})
