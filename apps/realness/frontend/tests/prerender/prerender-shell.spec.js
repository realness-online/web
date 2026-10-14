import { describe, expect, it } from 'vite-plus/test'
import { flushPromises as flush_promises, mount } from '@vue/test-utils'
import PrerenderShell from '@/prerender/prerender-shell.vue'

describe('prerender-shell', () => {
  it('renders the support layout inside a suspense boundary', async () => {
    const shell = mount(PrerenderShell, {
      global: { stubs: { SupportLayout: { template: '<main data-layout />' } } }
    })
    await flush_promises()
    expect(shell.find('main[data-layout]').exists()).toBe(true)
  })
})
