import { describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import AsConversation from '@/components/chat/as-conversation.vue'

vi.mock('@/utils/chat-parts', () => ({ create_parts: () => () => {} }))

const fake_chat = (overrides = {}) => ({
  messages: ref([]),
  draft: ref(''),
  status: ref(''),
  working: ref(false),
  send: vi.fn(),
  ...overrides
})

describe('conversation input', () => {
  it('suggests commands for a slash, and a pick fills the input', async () => {
    const chat = fake_chat()
    const wrapper = mount(AsConversation, { props: { chat } })
    expect(wrapper.find('menu').exists()).toBe(false)
    chat.draft.value = '/th'
    await wrapper.vm.$nextTick()
    const buttons = wrapper.findAll('menu button')
    expect(buttons.map(button => button.text())).toEqual([
      '/thinking Show or set the thinking level'
    ])
    await buttons[0].trigger('click')
    expect(chat.draft.value).toBe('/thinking ')
    wrapper.unmount()
  })
})
