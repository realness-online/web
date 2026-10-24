import {
  afterEach as after_each,
  beforeEach as before_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'
import { flushPromises as flush_promises, mount } from '@vue/test-utils'

vi.mock('@/utils/serverless', async () => {
  const { ref } = await import('vue')
  return { current_user: ref({ uid: 'me' }) }
})

import AsChatToggle from '@/components/chat/as-chat-toggle.vue'
import { use_home_view } from '@/use/home-view'
import { home_view } from '@/utils/preference'

before_each(() => {
  home_view.value = 'thoughts'
  use_home_view().wide.value = true
})
after_each(() => {
  home_view.value = 'thoughts'
})

describe('chat toggles', () => {
  it('the outside chevron opens chat and hands off to the one inside', async () => {
    const outside = mount(AsChatToggle)
    const inside = mount(AsChatToggle, { props: { inside: true } })
    expect(outside.attributes('aria-label')).toBe('Open chat')
    await outside.trigger('click')
    expect(home_view.value).toBe('chat-thoughts')
    expect(outside.find('button').exists()).toBe(false)
    expect(inside.attributes('aria-pressed')).toBe('true')
    expect(inside.attributes('aria-label')).toBe('Close chat')
    await inside.trigger('click')
    expect(home_view.value).toBe('thoughts')
  })

  it('only the chevron that remains swings: inside on open, outside on close', async () => {
    const swings = []
    const animate = vi
      .spyOn(Element.prototype, 'animate')
      .mockImplementation(function (keyframes) {
        if (document.body.contains(this)) swings.push(keyframes)
      })
    const outside = mount(AsChatToggle, { attachTo: document.body })
    const inside = mount(AsChatToggle, {
      props: { inside: true },
      attachTo: document.body
    })
    expect(swings).toHaveLength(0)
    expect(inside.find('button').exists()).toBe(false)
    await outside.trigger('click')
    await flush_promises()
    expect(outside.find('button').exists()).toBe(false)
    await inside.find('button').trigger('click')
    await flush_promises()
    expect(inside.find('button').exists()).toBe(false)
    expect(swings.map(frames => frames.map(frame => frame.rotate))).toEqual([
      ['y 0deg', 'y 180deg'],
      ['y 180deg', 'y 360deg']
    ])
    animate.mockRestore()
    outside.unmount()
    inside.unmount()
  })

  it('beside the TUI, the chevron keeps the TUI', async () => {
    home_view.value = 'chat-tui'
    await mount(AsChatToggle, { props: { inside: true } }).trigger('click')
    expect(home_view.value).toBe('tui')
  })
})
