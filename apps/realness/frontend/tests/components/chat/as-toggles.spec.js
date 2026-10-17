import {
  afterEach as after_each,
  beforeEach as before_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'
import { mount } from '@vue/test-utils'

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
  it('the speech bubble turns side chat on and off', async () => {
    const bubble = mount(AsChatToggle)
    expect(bubble.attributes('aria-label')).toBe('Open chat')
    await bubble.trigger('click')
    expect(home_view.value).toBe('chat-thoughts')
    expect(bubble.attributes('aria-pressed')).toBe('true')
    expect(bubble.attributes('aria-label')).toBe('Close chat')
    await bubble.trigger('click')
    expect(home_view.value).toBe('thoughts')
  })

  it('beside the TUI, the bubble keeps the TUI', async () => {
    home_view.value = 'chat-tui'
    await mount(AsChatToggle).trigger('click')
    expect(home_view.value).toBe('tui')
  })
})
