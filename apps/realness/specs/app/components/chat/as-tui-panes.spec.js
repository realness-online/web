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

const button = (pane, text) =>
  pane.findAll('menu button').find(found => found.text() === text)

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

  it('splits into the next free pane, stops at four, and saves each change', async () => {
    const pane = await open()
    await button(pane, 'Split').trigger('click')
    await flush_promises()
    expect(terminals(pane)).toEqual(['Terminal', 'Terminal p1'])
    expect(mock_save).toHaveBeenLastCalledWith(
      expect.anything(),
      'a-mine00000000',
      { panes: [{ session: null }, { session: 'p1' }], direction: 'row' }
    )
    await button(pane, 'Split').trigger('click')
    await button(pane, 'Split').trigger('click')
    await flush_promises()
    expect(terminals(pane)).toHaveLength(4)
    expect(button(pane, 'Split').attributes('disabled')).toBeDefined()
    await button(pane, 'Split').trigger('click')
    await flush_promises()
    expect(terminals(pane)).toHaveLength(4)
  })

  it('turns the split, and closes a pane without touching the main one', async () => {
    const pane = await open()
    expect(button(pane, 'Stack')).toBeUndefined()
    await button(pane, 'Split').trigger('click')
    await flush_promises()
    await button(pane, 'Stack').trigger('click')
    expect(pane.get('[data-panes]').attributes('data-direction')).toBe('column')
    expect(mock_save).toHaveBeenLastCalledWith(
      expect.anything(),
      'a-mine00000000',
      expect.objectContaining({ direction: 'column' })
    )
    await button(pane, 'Side by side').trigger('click')
    expect(pane.get('[data-panes]').attributes('data-direction')).toBe('row')
    const closes = pane.findAll('[aria-label="Close pane"]')
    expect(closes).toHaveLength(1)
    await closes[0].trigger('click')
    expect(terminals(pane)).toEqual(['Terminal'])
    expect(mock_close).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+Alt+arrows move between panes; plain arrows stay with the app', async () => {
    mock_load.mockResolvedValueOnce({
      panes: [{ session: null }, { session: 'p1' }]
    })
    const pane = await open()
    const [main, side] = pane.findAll('[data-terminal] canvas')
    main.element.focus()
    await main.trigger('focusin')
    await pane
      .get('[data-panes]')
      .trigger('keydown', { key: 'ArrowRight', ctrlKey: true, altKey: true })
    expect(document.activeElement).toBe(side.element)
    await pane.get('[data-panes]').trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(side.element)
    await pane
      .get('[data-panes]')
      .trigger('keydown', { key: 'Enter', ctrlKey: true, altKey: true })
    expect(document.activeElement).toBe(side.element)
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
