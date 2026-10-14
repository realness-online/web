import { describe, it, expect } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import PrerenderShell from '@/prerender/prerender-shell.vue'
import SupportLayout from '@/components/support-layout'

describe('@/prerender/prerender-shell', () => {
  it('renders the support layout inside a suspense boundary', async () => {
    const wrapper = shallowMount(PrerenderShell, {
      global: {
        stubs: {
          Suspense: false,
          'support-layout': {
            name: 'SupportLayout',
            template: '<div class="support-layout-stub" />'
          }
        }
      }
    })
    await flushPromises()

    expect(wrapper.find('.support-layout-stub').exists()).toBe(true)
    expect(SupportLayout).toBeTruthy()
  })
})
