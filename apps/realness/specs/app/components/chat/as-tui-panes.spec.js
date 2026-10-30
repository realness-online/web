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

const { mock_mount, mock_close, mock_open_terminal, mock_load, mock_save } =
  vi.hoisted(() => {
    const mock_close = vi.fn()
    return {
      mock_close,
      mock_mount: vi.fn(async () => ({ close: mock_close })),
      mock_open_terminal: vi.fn(),
      mock_load: vi.fn(async () => null),
      mock_save: vi.fn(async () => {})
    }
  })
vi.mock('@/terminal/terminal.js', () => ({ mount: mock_mount }))
vi.mock('@/utils/gate', async import_original => ({
  ...(await import_original()),
  start_actor: vi.fn(async (_, options) => ({
    id: options.actor,
    created: false,
    startup_id: 'pane-startup'
  })),
  open_terminal: mock_open_terminal,
  load_layout: mock_load,
  save_layout: mock_save
}))
vi.mock('@/utils/serverless', async () => {
  const { ref } = await import('vue')
  return { current_user: ref({ getIdToken: async () => 'id.token' }) }
})

import AsTui from '@/components/chat/as-tui.vue'
import { use_home_view } from '@/use/home-view'
import { home_view } from '@/utils/preference'

let socket
before_each(() => {
  for (const fn of [mock_mount, mock_close, mock_open_terminal, mock_save])
    fn.mockClear()
  mock_load.mockReset()
  mock_load.mockResolvedValue(null)
  socket = Object.assign(new EventTarget(), { close: vi.fn() })
  mock_open_terminal.mockResolvedValue(socket)
  mock_mount.mockImplementation(async (_, options) => {
    options.open?.({ cols: 80, rows: 24 }).catch(() => {})
    return { close: mock_close }
  })
  home_view.value = 'tui'
  use_home_view().wide.value = true
})

after_each(() => {
  home_view.value = 'thoughts'
})

enable_auto_unmount(after_each)

const open = async () => {
  const pane = mount(AsTui, {
    props: { actor: 'a-mine00000000' },
    global: { provide: { set_working: () => {} } },
    attachTo: document.body
  })
  await flush_promises()
  return pane
}

const terminals = pane =>
  pane.findAll('[data-terminal]').map(stage => stage.attributes('aria-label'))

/** A Ghostty-style key on the panes wrapper. */
const key = (pane, init) => pane.get('[data-panes]').trigger('keydown', init)

describe('@/components/chat/as-tui panes', () => {
  it('restores a saved layout and mounts each pane in order', async () => {
    mock_load.mockResolvedValueOnce({
      panes: [{ session: null }, { session: 'p1' }],
      direction: 'column'
    })
    const pane = await open()
    expect(terminals(pane)).toEqual(['Terminal', 'Terminal p1'])
    expect(pane.get('[data-panes]').attributes('data-direction')).toBe('column')
    expect(mock_mount).toHaveBeenCalledTimes(2)
  })

  it('keeps one pane when the saved layout cannot be trusted', async () => {
    for (const layout of [
      { panes: [{ session: 'p1' }] },
      {
        panes: Array.from({ length: 5 }, (_, n) => ({
          session: n ? `p${n}` : null
        }))
      },
      { panes: 'not a list' }
    ]) {
      mock_load.mockResolvedValueOnce(layout)
      const pane = await open()
      expect(terminals(pane)).toEqual(['Terminal'])
      pane.unmount()
    }
    mock_load.mockRejectedValueOnce(new Error('older halo'))
    const pane = await open()
    expect(terminals(pane)).toEqual(['Terminal'])
    expect(pane.find('[role="alert"]').exists()).toBe(false)
  })

  it('Option+Cmd+D splits right, Shift+D down, stops at four, and saves each change', async () => {
    const split_key = (target, init) =>
      key(target, { metaKey: true, altKey: true, ...init })
    const pane = await open()
    await split_key(pane, { key: 'd' })
    await flush_promises()
    expect(terminals(pane)).toEqual(['Terminal', 'Terminal p1'])
    expect(pane.get('[data-panes]').attributes('data-direction')).toBe('row')
    expect(mock_save).toHaveBeenLastCalledWith(
      expect.anything(),
      'a-mine00000000',
      { panes: [{ session: null }, { session: 'p1' }], direction: 'row' }
    )
    const fresh = await open()
    await split_key(fresh, { key: 'D', shiftKey: true })
    await flush_promises()
    expect(fresh.get('[data-panes]').attributes('data-direction')).toBe(
      'column'
    )
    fresh.unmount()
    await split_key(pane, { key: 'd' })
    await split_key(pane, { key: 'd' })
    await flush_promises()
    expect(terminals(pane)).toHaveLength(4)
    await split_key(pane, { key: 'd' })
    await flush_promises()
    expect(terminals(pane)).toHaveLength(4)
  })

  it('has no split or close buttons, and Cmd alone keeps the browser keys', async () => {
    const pane = await open()
    expect(pane.find('menu').exists()).toBe(false)
    expect(pane.find('[aria-label="Close pane"]').exists()).toBe(false)
    await key(pane, { key: 'd', metaKey: true })
    await flush_promises()
    expect(terminals(pane)).toEqual(['Terminal'])
    await key(pane, { key: 'd', metaKey: true, altKey: true })
    await flush_promises()
    await key(pane, { key: 'w', metaKey: true, altKey: true })
    expect(terminals(pane)).toEqual(['Terminal', 'Terminal p1'])
  })

  it('a shell that exits closes its split pane', async () => {
    const pane = await open()
    await key(pane, { key: 'd', metaKey: true, altKey: true })
    await flush_promises()
    expect(terminals(pane)).toEqual(['Terminal', 'Terminal p1'])
    mock_mount.mock.calls[1][1].on_exit(0)
    await flush_promises()
    expect(terminals(pane)).toEqual(['Terminal'])
  })

  it('Option+Cmd steps with arrows and [ ]; plain keys stay with the app', async () => {
    mock_load.mockResolvedValueOnce({
      panes: [{ session: null }, { session: 'p1' }]
    })
    const pane = await open()
    const [main, side] = pane.findAll('[data-terminal] canvas')
    main.element.focus()
    await main.trigger('focusin')
    await key(pane, { key: 'ArrowRight', metaKey: true, altKey: true })
    expect(document.activeElement).toBe(side.element)
    await key(pane, { key: 'ArrowLeft', metaKey: true, altKey: true })
    expect(document.activeElement).toBe(main.element)
    await key(pane, { key: ']', metaKey: true, altKey: true })
    expect(document.activeElement).toBe(side.element)
    await key(pane, { key: '[', metaKey: true, altKey: true })
    expect(document.activeElement).toBe(main.element)
    await key(pane, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(main.element)
    await key(pane, { key: 'ArrowRight', ctrlKey: true, altKey: true })
    expect(document.activeElement).toBe(main.element)
  })

  it('says the connection closed when the socket closes before it opens', async () => {
    mock_mount.mockImplementationOnce(async (_, options) => {
      options.open({ cols: 80, rows: 24 }).catch(() => {})
      return { close: mock_close }
    })
    const pane = await open()
    socket.dispatchEvent(new Event('close'))
    await flush_promises()
    expect(pane.get('[role="alert"]').text()).toBe('Terminal connection closed')
  })
})
