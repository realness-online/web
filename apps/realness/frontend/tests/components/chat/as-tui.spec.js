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

const { mock_mount, mock_close, mock_start_actor, mock_open_terminal } =
  vi.hoisted(() => {
    const mock_close = vi.fn()
    return {
      mock_close,
      mock_mount: vi.fn(async () => ({ close: mock_close })),
      mock_start_actor: vi.fn(async (_, options) => ({
        id: options.actor,
        created: false,
        startup_id: 'terminal-startup'
      })),
      mock_open_terminal: vi.fn()
    }
  })
vi.mock('@/terminal/terminal.js', () => ({ mount: mock_mount }))
vi.mock('@/utils/gate', async import_original => ({
  ...(await import_original()),
  start_actor: mock_start_actor,
  open_terminal: mock_open_terminal
}))
vi.mock('@/utils/serverless', async () => {
  const { ref } = await import('vue')
  return { current_user: ref({ getIdToken: async () => 'id.token' }) }
})

import AsTui from '@/components/chat/as-tui.vue'
import { use_home_view } from '@/use/home-view'
import { home_view } from '@/utils/preference'

const set_working = vi.fn()
let socket
before_each(() => {
  set_working.mockClear()
  mock_mount.mockClear()
  mock_close.mockClear()
  mock_start_actor.mockClear()
  mock_open_terminal.mockClear()
  socket = Object.assign(new EventTarget(), { close: vi.fn() })
  mock_open_terminal.mockResolvedValue(socket)
  home_view.value = 'thoughts'
  use_home_view().wide.value = true
})

after_each(() => {
  home_view.value = 'thoughts'
})

enable_auto_unmount(after_each)

const open = async (actor = 'a-mine00000000') => {
  const pane = mount(AsTui, {
    props: { actor },
    global: { provide: { set_working } }
  })
  await flush_promises()
  return pane
}

describe('@/components/chat/as-tui', () => {
  it('shows connecting and lookup failure with a retry action', async () => {
    home_view.value = 'tui'
    const pane = await open(null)
    await pane.setProps({ finding: true })
    expect(pane.get('[role="status"]').text()).toBe('Connecting...')
    expect(pane.get('#tui-pane').attributes('aria-busy')).toBe('true')
    await pane.setProps({ finding: false, problem: 'Realness answered 502' })
    expect(pane.get('[role="alert"]').text()).toContain('Realness answered 502')
    expect(pane.get('#tui-pane').attributes('aria-busy')).toBeUndefined()
    await pane.get('button').trigger('click')
    expect(pane.emitted('retry')).toHaveLength(1)
    expect(mock_mount).not.toHaveBeenCalled()
  })

  it('uses shared working while loading the terminal and clears it on failure', async () => {
    home_view.value = 'tui'
    let fail
    mock_mount.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          fail = reject
        })
    )
    const pane = await open()
    expect(pane.get('[role="status"]').text()).toBe('Connecting...')
    expect(set_working).toHaveBeenLastCalledWith(true)
    fail(new Error('engine unavailable'))
    await flush_promises()
    expect(pane.get('[role="alert"]').text()).toContain('engine unavailable')
    expect(set_working).toHaveBeenLastCalledWith(false)
    await pane.get('button').trigger('click')
    await flush_promises()
    expect(mock_mount).toHaveBeenCalledTimes(2)
    expect(pane.find('[role="status"]').exists()).toBe(false)
  })

  it('shows real VM stages, then waits for the socket open before clearing working', async () => {
    home_view.value = 'tui'
    let finish
    mock_start_actor.mockImplementationOnce((_, options) => {
      options.on_progress({
        type: 'startup-stage',
        startup_id: 'terminal-startup',
        stage: 'starting_actor',
        state: 'starting',
        elapsed_ms: 8400
      })
      return new Promise(resolve => {
        finish = resolve
      })
    })
    mock_mount.mockImplementationOnce(async (_, options) => {
      options.open({ cols: 80, rows: 24 }).catch(() => {})
      return { close: mock_close }
    })
    const pane = await open()
    expect(pane.get('[role="status"]').text()).toBe('Starting actor')
    expect(pane.get('time').text()).toBe('8.4 s reported')
    expect(mock_open_terminal).not.toHaveBeenCalled()
    finish({
      id: 'a-mine00000000',
      startup_id: 'terminal-startup',
      created: false
    })
    await flush_promises()
    expect(pane.get('[role="status"]').text()).toBe('Connecting terminal')
    expect(set_working).toHaveBeenLastCalledWith(true)
    socket.dispatchEvent(new Event('open'))
    await flush_promises()
    expect(pane.find('section[aria-label="Connection status"]').exists()).toBe(
      false
    )
    expect(set_working.mock.calls).toEqual([[true], [false]])
  })

  it('shows socket failure in warning feedback with Retry', async () => {
    home_view.value = 'tui'
    mock_mount.mockImplementationOnce(async (_, options) => {
      options.open({ cols: 80, rows: 24 }).catch(() => {})
      return { close: mock_close }
    })
    const pane = await open()
    socket.dispatchEvent(new Event('error'))
    await flush_promises()
    expect(pane.get('[role="alert"]').text()).toBe('Terminal connection failed')
    expect(set_working).toHaveBeenLastCalledWith(false)
    await pane
      .get('section[aria-label="Connection status"] button')
      .trigger('click')
    await flush_promises()
    expect(mock_close).toHaveBeenCalledTimes(1)
    expect(mock_mount).toHaveBeenCalledTimes(2)
  })

  it('does not open a socket after unmount during actor startup', async () => {
    home_view.value = 'tui'
    let finish
    mock_start_actor.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    mock_mount.mockImplementationOnce(async (_, options) => {
      options.open({ cols: 80, rows: 24 }).catch(() => {})
      return { close: mock_close }
    })
    const pane = await open()
    pane.unmount()
    await expect(
      mock_mount.mock.calls[0][1].open({ cols: 80, rows: 24 })
    ).rejects.toMatchObject({
      name: 'AbortError'
    })
    finish({
      id: 'a-mine00000000',
      startup_id: 'terminal-startup',
      created: false
    })
    await flush_promises()
    expect(mock_open_terminal).not.toHaveBeenCalled()
    expect(set_working.mock.calls).toEqual([[true], [false]])
  })

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
      actor: 'a-mine00000000'
    })
    expect(mock_mount.mock.calls[0][1]).not.toHaveProperty('exec')
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
