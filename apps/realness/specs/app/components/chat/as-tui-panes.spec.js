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
import { use_key_commands } from '@/use/key-commands'

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

/** Each pane gets its own key commands, run as the Option+Space panel would. */
const open = async () => {
  const keys = use_key_commands()
  const pane = mount(AsTui, {
    props: { actor: 'a-mine00000000' },
    global: { provide: { set_working: () => {}, 'key-commands': keys } },
    attachTo: document.body
  })
  pane.keys = keys
  await flush_promises()
  return pane
}

const terminals = pane =>
  pane.findAll('[data-terminal]').map(stage => stage.attributes('aria-label'))

/** Where a pane sits, from its inline style. */
const box = (pane, label) => {
  const { top, left } = pane.get(`[aria-label="${label}"]`).element.style
  return { top, left }
}

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
    expect(box(pane, 'Terminal p1')).toMatchObject({ top: '50%', left: '0%' })
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

  it('\\ splits the focused pane right, - splits it below, stops at four, and saves', async () => {
    const pane = await open()
    const run = command => pane.keys.run_command(command)
    run('view::Split_Right')
    await flush_promises()
    expect(terminals(pane)).toEqual(['Terminal', 'Terminal p1'])
    expect(box(pane, 'Terminal p1')).toMatchObject({ top: '0%', left: '50%' })
    expect(mock_save).toHaveBeenLastCalledWith(
      expect.anything(),
      'a-mine00000000',
      { tree: { split: 'row', a: { session: null }, b: { session: 'p1' } } }
    )
    run('view::Split_Down')
    await flush_promises()
    expect(box(pane, 'Terminal p1')).toMatchObject({ top: '0%', left: '50%' })
    expect(box(pane, 'Terminal p2')).toMatchObject({ top: '50%', left: '50%' })
    expect(box(pane, 'Terminal')).toMatchObject({ top: '0%', left: '0%' })
    run('view::Split_Right')
    await flush_promises()
    expect(terminals(pane)).toHaveLength(4)
    run('view::Split_Down')
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
    expect(terminals(pane)).toEqual(['Terminal'])
  })

  it('a shell that exits closes its split pane', async () => {
    const pane = await open()
    pane.keys.run_command('view::Split_Right')
    await flush_promises()
    expect(terminals(pane)).toEqual(['Terminal', 'Terminal p1'])
    mock_mount.mock.calls[1][1].on_exit(0)
    await flush_promises()
    expect(terminals(pane)).toEqual(['Terminal'])
  })

  it('panel [ and ] step panes; panel keys wait while the terminal is hidden', async () => {
    mock_load.mockResolvedValueOnce({
      panes: [{ session: null }, { session: 'p1' }]
    })
    const pane = await open()
    const [main, side] = pane.findAll('[data-terminal] canvas')
    main.element.focus()
    await main.trigger('focusin')
    pane.keys.run_command('view::Pane_Next')
    expect(document.activeElement).toBe(side.element)
    pane.keys.run_command('view::Pane_Previous')
    expect(document.activeElement).toBe(main.element)
    home_view.value = 'thoughts'
    pane.keys.run_command('view::Split_Right')
    await flush_promises()
    expect(terminals(pane)).toHaveLength(2)
  })

  it('panel arrows move to the pane on that side; Option+Cmd keys stay with the browser', async () => {
    mock_load.mockResolvedValueOnce({
      panes: [{ session: null }, { session: 'p1' }]
    })
    const pane = await open()
    const [main, side] = pane.findAll('[data-terminal] canvas')
    main.element.focus()
    await main.trigger('focusin')
    for (const init of [
      { key: 'ArrowRight', metaKey: true, altKey: true },
      { key: ']', metaKey: true, altKey: true },
      { key: 'ArrowRight' }
    ]) {
      await key(pane, init)
      expect(document.activeElement).toBe(main.element)
    }
    pane.keys.run_command('view::Pane_Right')
    expect(document.activeElement).toBe(side.element)
    await side.trigger('focusin')
    pane.keys.run_command('view::Pane_Right')
    expect(document.activeElement).toBe(side.element)
    pane.keys.run_command('view::Pane_Left')
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
