import {
  afterEach as after_each,
  beforeEach as before_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'
import {
  enableAutoUnmount as enable_auto_unmount,
  flushPromises as flush_promises,
  mount
} from '@vue/test-utils'

const { mock_mount, mock_close } = vi.hoisted(() => {
  const mock_close = vi.fn()
  return { mock_close, mock_mount: vi.fn(async () => ({ close: mock_close })) }
})
vi.mock('../../../terminal/src/terminal.js', () => ({ mount: mock_mount }))
vi.mock('@/utils/serverless', async () => {
  const { ref } = await import('vue')
  return { current_user: ref({ getIdToken: async () => 'id.token' }) }
})

import AsTui from '@/components/chat/as-tui.vue'
import { use_home_view } from '@/use/home-view'
import { home_view } from '@/utils/preference'

before_each(() => {
  mock_mount.mockClear()
  mock_close.mockClear()
  home_view.value = 'thoughts'
  use_home_view().wide.value = true
})

after_each(() => {
  home_view.value = 'thoughts'
})

enable_auto_unmount(after_each)

const open = async (actor = 'a-mine00000000') => {
  const pane = mount(AsTui, { props: { actor } })
  await flush_promises()
  return pane
}

describe('@/components/chat/as-tui', () => {
  it('stays unconnected and inert until the TUI shows', async () => {
    const pane = await open()
    expect(mock_mount).not.toHaveBeenCalled()
    expect(pane.find('section#tui-pane').attributes('inert')).toBeDefined()
  })

  it('connects the first time it shows, then stays connected', async () => {
    const pane = await open()
    home_view.value = 'chat-tui'
    await flush_promises()
    expect(mock_mount).toHaveBeenCalledTimes(1)
    expect(mock_mount.mock.calls[0][1]).toMatchObject({
      actor: 'a-mine00000000',
      exec: 'brayness'
    })
    expect(pane.find('section#tui-pane').attributes('data-open')).toBeDefined()
    home_view.value = 'thoughts'
    await flush_promises()
    home_view.value = 'tui'
    await flush_promises()
    expect(mock_mount).toHaveBeenCalledTimes(1)
    expect(pane.find('section#tui-pane').attributes('data-alone')).toBeDefined()
    expect(mock_close).not.toHaveBeenCalled()
  })

  it('never connects on a narrow screen', async () => {
    use_home_view().wide.value = false
    home_view.value = 'tui'
    await open()
    expect(mock_mount).not.toHaveBeenCalled()
  })

  it('closes the terminal when the page goes', async () => {
    home_view.value = 'tui'
    const pane = await open()
    pane.unmount()
    expect(mock_close).toHaveBeenCalledTimes(1)
  })
})
