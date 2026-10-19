import { describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'

vi.mock('@/utils/serverless', async () => {
  const { ref } = await import('vue')
  return { current_user: ref({ uid: 'actor' }), me: ref({ name: 'Scott' }) }
})
vi.mock('@/use/home-view', async () => ({
  use_home_view: () => ({
    shows: { value: { chat: false } },
    set_view: vi.fn()
  })
}))

import AsTuiNav from '@/components/chat/as-tui-nav.vue'

const mount_nav = () =>
  mount(AsTuiNav, {
    global: {
      stubs: {
        'as-chat-toggle': true,
        'logo-as-link': true,
        'router-link': { props: ['to'], template: '<a :href="to"><slot /></a>' }
      }
    }
  })

describe('AsTuiNav', () => {
  it('links to the account, signed in', () => {
    const account = mount_nav().find('a[href="/account"]')
    expect(account.exists()).toBe(true)
    expect(account.text()).toBe('Scott')
  })
})
