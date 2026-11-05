import { describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { nextTick as next_tick, ref } from 'vue'
import AsConversation from '@/components/chat/as-conversation.vue'

vi.mock('@/utils/chat-parts', () => ({ create_parts: () => () => {} }))

const travelling = () =>
  document
    .getAnimations()
    .filter(
      animation =>
        animation.animationName === 'chat-edge-travel' &&
        animation.playState === 'running'
    )

describe('chat working border', () => {
  it('moves only while the agent works', async () => {
    const working = ref(false)
    const chat = {
      messages: ref([]),
      draft: ref(''),
      status: ref(''),
      working,
      send: vi.fn()
    }
    const wrapper = mount(AsConversation, {
      props: { chat },
      attachTo: document.body
    })
    await next_tick()
    expect(travelling()).toHaveLength(0)
    working.value = true
    await next_tick()
    expect(travelling()).toHaveLength(1)
    working.value = false
    await next_tick()
    expect(travelling()).toHaveLength(0)
    wrapper.unmount()
  })
})
