import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import AsConversation from '@/components/chat/as-conversation.vue'

vi.mock('@/utils/chat-parts', () => ({ create_parts: () => () => {} }))

const scroll_spy = vi.fn()
const original = HTMLElement.prototype.scrollIntoView

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = scroll_spy
})
afterAll(() => {
  HTMLElement.prototype.scrollIntoView = original
})

const fake_chat = messages => ({
  messages: ref(messages),
  draft: ref(''),
  status: ref(''),
  working: ref(false),
  send: vi.fn()
})

const message = text => ({ sender: 'You', text })

/** Fix the list's height and scroll position, then report where it sits. */
const place_scroll = async (
  wrapper,
  { scroll_height, client_height, scroll_top }
) => {
  const list = wrapper.get('ol[data-chat]').element
  for (const [name, value] of Object.entries({
    scrollHeight: scroll_height,
    clientHeight: client_height,
    scrollTop: scroll_top
  }))
    Object.defineProperty(list, name, { value, configurable: true })
  await wrapper.get('ol[data-chat]').trigger('scroll')
}

const mount_with = async messages => {
  const wrapper = mount(AsConversation, {
    props: { chat: fake_chat(messages) }
  })
  await wrapper.vm.$nextTick()
  scroll_spy.mockClear()
  return wrapper
}

describe('conversation scrolling', () => {
  it('follows a new message when the newest one is on screen', async () => {
    const wrapper = await mount_with([message('one')])
    await place_scroll(wrapper, {
      scroll_height: 500,
      client_height: 500,
      scroll_top: 0
    })
    wrapper.vm.chat.messages.value.push(message('two'))
    await vi.waitFor(() => expect(scroll_spy).toHaveBeenCalled())
    wrapper.unmount()
  })

  it('leaves the reader alone when they scrolled up', async () => {
    const wrapper = await mount_with([message('one')])
    await place_scroll(wrapper, {
      scroll_height: 2000,
      client_height: 500,
      scroll_top: 100
    })
    wrapper.vm.chat.messages.value.push(message('two'))
    await wrapper.vm.$nextTick()
    expect(scroll_spy).not.toHaveBeenCalled()
    expect(wrapper.find('button[data-latest]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('returns to the newest message from the button', async () => {
    const wrapper = await mount_with([message('one')])
    await place_scroll(wrapper, {
      scroll_height: 2000,
      client_height: 500,
      scroll_top: 100
    })
    await wrapper.get('button[data-latest]').trigger('click')
    await vi.waitFor(() => expect(scroll_spy).toHaveBeenCalled())
    expect(wrapper.find('button[data-latest]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('labels the button with its shortcut', async () => {
    const wrapper = await mount_with([message('one')])
    await place_scroll(wrapper, {
      scroll_height: 2000,
      client_height: 500,
      scroll_top: 100
    })
    const button = wrapper.get('button[data-latest]')
    expect(button.attributes('aria-label')).toBe('Jump to latest message')
    expect(button.attributes('title')).toBe('Jump to latest message · Ctrl+End')
    wrapper.unmount()
  })

  it('stays hidden after a small scroll', async () => {
    const wrapper = await mount_with([message('one')])
    await place_scroll(wrapper, {
      scroll_height: 2000,
      client_height: 500,
      scroll_top: 1300
    })
    expect(wrapper.find('button[data-latest]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('returns to the newest message on Ctrl+End', async () => {
    const wrapper = await mount_with([message('one')])
    await place_scroll(wrapper, {
      scroll_height: 2000,
      client_height: 500,
      scroll_top: 100
    })
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', ctrlKey: true })
    )
    await vi.waitFor(() => expect(scroll_spy).toHaveBeenCalled())
    await wrapper.vm.$nextTick()
    expect(wrapper.find('button[data-latest]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('sending a message returns to the newest one', async () => {
    const wrapper = await mount_with([message('one')])
    const { chat } = wrapper.vm.$.props
    await place_scroll(wrapper, {
      scroll_height: 2000,
      client_height: 500,
      scroll_top: 100
    })
    await wrapper.get('form[data-chat]').trigger('submit')
    expect(chat.send).toHaveBeenCalled()
    expect(wrapper.find('button[data-latest]').exists()).toBe(false)
    wrapper.unmount()
  })
})
