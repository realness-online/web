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

  it('swaps the input for a take-back button while another tab has the chat', async () => {
    const taken = ref(true)
    const chat = fake_chat({ taken, take_back: vi.fn() })
    const wrapper = mount(AsConversation, { props: { chat } })
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.get('section[data-taken] p').text()).toBe(
      'Another tab is using this chat.'
    )
    await wrapper.get('section[data-taken] button').trigger('click')
    expect(chat.take_back).toHaveBeenCalledOnce()
    taken.value = false
    await wrapper.vm.$nextTick()
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.find('section[data-taken]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('steps through earlier inputs with the arrows and returns to the draft', async () => {
    const chat = fake_chat({
      messages: ref([
        { sender: 'You', text: 'first' },
        { sender: 'Realness', text: 'reply' },
        { sender: 'You', text: 'second' }
      ])
    })
    const wrapper = mount(AsConversation, { props: { chat } })
    const field = wrapper.get('textarea')
    chat.draft.value = 'half'
    await field.trigger('keydown', { key: 'ArrowUp' })
    expect(chat.draft.value).toBe('second')
    await field.trigger('keydown', { key: 'ArrowUp' })
    expect(chat.draft.value).toBe('first')
    await field.trigger('keydown', { key: 'ArrowUp' })
    expect(chat.draft.value).toBe('first')
    await field.trigger('keydown', { key: 'ArrowDown' })
    expect(chat.draft.value).toBe('second')
    await field.trigger('keydown', { key: 'ArrowDown' })
    expect(chat.draft.value).toBe('half')
    wrapper.unmount()
  })

  it('leaves the arrows alone inside a multiline draft', async () => {
    const chat = fake_chat({ messages: ref([{ sender: 'You', text: 'old' }]) })
    const wrapper = mount(AsConversation, { props: { chat } })
    const field = wrapper.get('textarea')
    chat.draft.value = 'one\ntwo'
    await wrapper.vm.$nextTick()
    field.element.setSelectionRange(6, 6)
    await field.trigger('keydown', { key: 'ArrowUp' })
    expect(chat.draft.value).toBe('one\ntwo')
    wrapper.unmount()
  })

  it('folds reasoning into a Thinking block above the answer', () => {
    const chat = fake_chat({
      messages: ref([
        { sender: 'Realness', text: 'Answer.', thinking: 'Weigh it.' },
        { sender: 'Realness', text: 'Plain.' }
      ])
    })
    const wrapper = mount(AsConversation, { props: { chat } })
    const items = wrapper.findAll('li')
    expect(items[0].get('details[data-thinking]').attributes('open')).toBe(
      undefined
    )
    expect(items[0].get('details summary').text()).toBe('Thinking')
    expect(items[0].get('details p').text()).toBe('Weigh it.')
    expect(items[1].find('details').exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens and closes every Thinking block together', async () => {
    const chat = fake_chat({
      messages: ref([
        { sender: 'Realness', text: 'One.', thinking: 'a' },
        { sender: 'Realness', text: 'Two.', thinking: 'b' }
      ])
    })
    const wrapper = mount(AsConversation, { props: { chat } })
    const [first, second] = wrapper.findAll('details[data-thinking]')
    first.element.open = true
    await first.trigger('toggle')
    expect(second.element.open).toBe(true)
    second.element.open = false
    await second.trigger('toggle')
    expect(first.element.open).toBe(false)
    wrapper.unmount()
  })

  it('sends when the field loses focus, as a thought saves', async () => {
    const send = vi.fn()
    const chat = fake_chat({ send, draft: ref('hi') })
    const wrapper = mount(AsConversation, { props: { chat } })
    await wrapper.find('textarea').trigger('focusout')
    expect(send).toHaveBeenCalledTimes(1)
    chat.draft.value = '  '
    await wrapper.find('textarea').trigger('focusout')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('keeps the field focused when a command is picked', async () => {
    const chat = fake_chat({ draft: ref('/') })
    const wrapper = mount(AsConversation, { props: { chat } })
    const event = new MouseEvent('mousedown', { cancelable: true })
    wrapper.find('menu button').element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('completes the first matching command with Tab', async () => {
    const chat = fake_chat({ draft: ref('/up') })
    const wrapper = mount(AsConversation, { props: { chat } })
    await wrapper.find('textarea').trigger('keydown', { key: 'Tab' })
    expect(chat.draft.value).toBe('/upstream')
  })

  it('adds a line on Shift+Return and sends on Return', async () => {
    const send = vi.fn()
    const wrapper = mount(AsConversation, {
      props: { chat: fake_chat({ send, draft: ref('hi') }) }
    })
    const box = wrapper.find('textarea')
    await box.trigger('keydown', { key: 'Enter', shiftKey: true })
    await box.trigger('keydown', { key: 'Enter', metaKey: true })
    await box.trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(send).not.toHaveBeenCalled()
    await box.trigger('keydown', { key: 'Enter' })
    expect(send).toHaveBeenCalledTimes(1)
  })
})
