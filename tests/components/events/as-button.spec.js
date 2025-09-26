import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import AsButton from '@/components/events/as-button.vue'

const MOCK_YEAR = 2020

describe('@/components/events/as-button', () => {
  let wrapper
  const mock_event = {
    id: 'test-event',
    date: new Date(MOCK_YEAR, 0, 1),
    title: 'Test Event'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = shallowMount(AsButton, {
      props: {
        itemid: 'test-itemid',
        event: mock_event
      }
    })
  })

  it('renders event button', () => {
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('displays event title', () => {
    expect(wrapper.text()).toContain(mock_event.title)
  })

  it('emits click event', async () => {
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })
})
