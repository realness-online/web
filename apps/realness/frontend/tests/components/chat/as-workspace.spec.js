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
import { reactive } from 'vue'

const mock_route = reactive({ query: {} })
vi.mock('vue-router', () => ({ useRoute: () => mock_route }))
vi.mock('@/utils/explorer', () => ({
  ask: vi.fn(async () => ({ text: 'Batman lives in Gotham' })),
  give_log: vi.fn()
}))
vi.mock('@/utils/serverless', async () => {
  const { ref } = await import('vue')
  return {
    current_user: ref({ uid: 'person-1', getIdToken: async () => 'id.token' }),
    me: ref({ name: 'Scott' })
  }
})

import AsWorkspace from '@/components/chat/as-workspace.vue'
import { use_key_commands } from '@/use/key-commands'
import { use_home_view } from '@/use/home-view'
import { home_view } from '@/utils/preference'

let calls
const set_working = vi.fn()
before_each(() => {
  vi.stubEnv('MODE', 'development')
  mock_route.query = {}
  mock_route.path = undefined
  home_view.value = 'thoughts'
  use_home_view().wide.value = true
  calls = []
  set_working.mockClear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      calls.push(url)
      if (url.endsWith('/v1/startup')) {
        const payload = JSON.parse(init.body)
        return new Response(
          `${JSON.stringify({ type: 'actor-ready', actor_id: payload.actor ?? 'a-mine00000000', startup_id: payload.startup_id ?? 'startup-test', created: false })}\n`
        )
      }
      if (url.endsWith('/chat/events'))
        return new Response(
          `${JSON.stringify({ type: 'history', messages: [] })}\n`
        )
      return new Response(
        JSON.stringify({ actors: [{ id: 'a-mine00000000' }], warn: null })
      )
    })
  )
})

after_each(() => {
  home_view.value = 'thoughts'
  document.body.replaceChildren()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

enable_auto_unmount(after_each)

let key_commands
const open = async () => {
  key_commands = use_key_commands()
  const page = mount(AsWorkspace, {
    attachTo: document.body,
    global: {
      provide: { 'key-commands': key_commands, set_working },
      stubs: {
        AsTui: {
          name: 'AsTui',
          props: ['actor', 'finding', 'problem', 'progress'],
          template: '<section><slot /></section>'
        },
        'router-link': { props: ['to'], template: '<a :href="to"><slot /></a>' }
      }
    }
  })
  await flush_promises()
  return page
}

const press = init =>
  window.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, ...init }))

describe('@/components/chat/as-workspace', () => {
  it('streams startup to the terminal while chat already takes input', async () => {
    mock_route.path = '/terminal'
    home_view.value = 'chat-tui'
    let controller
    fetch.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(value) {
            controller = value
          }
        })
      )
    )
    const page = await open()
    const stage = {
      type: 'startup-stage',
      startup_id: 'startup-test',
      actor_id: 'a-mine00000000',
      stage: 'restoring_files',
      state: 'starting',
      elapsed_ms: 8400
    }
    controller.enqueue(new TextEncoder().encode(`${JSON.stringify(stage)}\n`))
    await flush_promises()
    const terminal = page.findComponent({ name: 'AsTui' })
    expect(terminal.props('actor')).toBe(null)
    expect(terminal.props('progress').stage).toBe('restoring_files')
    expect(page.get('#chat-panel [role="status"]').text()).toBe('')
    expect(page.find('#chat-panel textarea').exists()).toBe(true)
    controller.enqueue(
      new TextEncoder().encode(
        `${JSON.stringify({ type: 'actor-ready', startup_id: 'startup-test', actor_id: 'a-mine00000000', created: false })}\n`
      )
    )
    controller.close()
    await flush_promises()
    expect(terminal.props('actor')).toBe('a-mine00000000')
    expect(page.find('textarea').exists()).toBe(true)
  })

  it('Retry rejoins a dropped progress stream rather than starting another operation', async () => {
    mock_route.path = '/terminal'
    fetch.mockResolvedValueOnce(
      new Response(
        `${JSON.stringify({ type: 'startup-stage', startup_id: 'startup-test', stage: 'starting_actor', state: 'starting', elapsed_ms: 100 })}\n`
      )
    )
    const page = await open()
    const terminal = page.findComponent({ name: 'AsTui' })
    expect(terminal.props('problem')).toContain('ended before')
    terminal.vm.$emit('retry')
    await flush_promises()
    const starts = fetch.mock.calls.filter(([url]) =>
      url.endsWith('/v1/startup')
    )
    expect(starts).toHaveLength(2)
    expect(JSON.parse(starts[1][1].body)).toEqual({
      startup_id: 'startup-test'
    })
    expect(terminal.props('actor')).toBe('a-mine00000000')
  })

  it('keeps terminal failure and retry separate from a working browser conversation', async () => {
    mock_route.path = '/terminal'
    home_view.value = 'chat-tui'
    let finish
    fetch.mockImplementationOnce(
      () =>
        new Promise(done => {
          finish = done
        })
    )
    const page = await open()
    const terminal = page.findComponent({ name: 'AsTui' })
    expect(terminal.props('finding')).toBe(true)
    expect(set_working).toHaveBeenLastCalledWith(true)
    finish(new Response('halo unreachable', { status: 502 }))
    await flush_promises()
    expect(terminal.props('finding')).toBe(false)
    expect(terminal.props('problem')).toBe('Realness answered 502')
    expect(set_working).toHaveBeenLastCalledWith(false)
    expect(page.find('#chat-panel [role="alert"]').exists()).toBe(false)
    expect(
      page.find('#chat-panel section[aria-label="Connection status"]').exists()
    ).toBe(false)
    await page.get('#chat-panel textarea').setValue('Who is Batman?')
    await page.get('#chat-panel form').trigger('submit')
    await flush_promises()
    expect(page.get('#chat-panel ol').text()).toContain(
      'Batman lives in Gotham'
    )
    terminal.vm.$emit('retry')
    await flush_promises()
    expect(terminal.props('actor')).toBe('a-mine00000000')
    expect(terminal.props('problem')).toBe('')
    expect(page.get('#chat-panel ol').text()).toContain(
      'Batman lives in Gotham'
    )
  })

  it('finds the actor only once chat or the TUI shows', async () => {
    await open()
    expect(calls).toHaveLength(0)
    key_commands.run_command('view::Toggle_Chat')
    await flush_promises()
    expect(home_view.value).toBe('chat-thoughts')
    expect(calls.some(url => url.endsWith('/v1/startup'))).toBe(true)
  })

  for (const [path, saved, expected] of [
    ['/', 'chat-thoughts', 'chat-thoughts'],
    ['/', 'thoughts', 'thoughts'],
    ['/terminal', 'chat-tui', 'chat-tui'],
    ['/terminal', 'tui', 'tui']
  ]) {
    it(`preserves saved ${saved} when reloading ${path}`, async () => {
      mock_route.path = path
      home_view.value = saved
      const page = await open()
      expect(home_view.value).toBe(expected)
      page.unmount()
      await open()
      expect(home_view.value).toBe(expected)
    })
  }

  it('takes the actor from the address when named', async () => {
    mock_route.query = { actor: 'a-named0000000' }
    home_view.value = 'chat'
    await open()
    const start = fetch.mock.calls.find(([url]) => url.endsWith('/v1/startup'))
    expect(JSON.parse(start[1].body).actor).toBe('a-named0000000')
  })

  it('registers the layouts and the chat toggle; unmounting removes them', async () => {
    const page = await open()
    key_commands.run_command('view::Layout_Tui')
    expect(home_view.value).toBe('tui')
    key_commands.run_command('view::Toggle_Chat')
    expect(home_view.value).toBe('chat-tui')
    key_commands.run_command('view::Layout_Chat')
    expect(home_view.value).toBe('chat')
    key_commands.run_command('view::Layout_Thoughts')
    expect(home_view.value).toBe('thoughts')
    page.unmount()
    expect(key_commands.command_handlers.has('view::Layout_Tui')).toBe(false)
  })

  it('Option+Tab switches inputs; Tab and Shift+Tab stay with Pi', async () => {
    mock_route.path = '/chat'
    const page = await open()
    home_view.value = 'chat-tui'
    await flush_promises()
    const pane = document.createElement('section')
    pane.id = 'tui-pane'
    pane.innerHTML = '<canvas tabindex="0"></canvas>'
    document.body.append(pane)
    const input = page.get('textarea').element
    const canvas = pane.querySelector('canvas')
    const terminal_key = vi.fn()
    window.addEventListener('keydown', terminal_key)
    const option_tab = () =>
      new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        altKey: true,
        bubbles: true,
        cancelable: true
      })
    try {
      input.focus()
      for (const target of [canvas, input]) {
        document.activeElement.dispatchEvent(option_tab())
        expect(document.activeElement).toBe(target)
      }
      expect(terminal_key).not.toHaveBeenCalled()
      canvas.focus()
      for (const shiftKey of [false, true]) {
        const tab = new KeyboardEvent('keydown', {
          key: 'Tab',
          code: 'Tab',
          shiftKey,
          bubbles: true,
          cancelable: true
        })
        canvas.dispatchEvent(tab)
        expect(tab.defaultPrevented).toBe(false)
        expect(document.activeElement).toBe(canvas)
      }
      expect(terminal_key).toHaveBeenCalledTimes(2)
      home_view.value = 'chat'
      await flush_promises()
      const alone = option_tab()
      input.dispatchEvent(alone)
      expect(alone.defaultPrevented).toBe(false)
    } finally {
      window.removeEventListener('keydown', terminal_key)
      pane.remove()
      page.unmount()
    }
  })

  it('opens chat alone and terminal alone through their routes', async () => {
    mock_route.path = '/chat'
    await open()
    expect(home_view.value).toBe('chat')
    mock_route.path = '/terminal'
    await flush_promises()
    expect(home_view.value).toBe('chat-tui')
    key_commands.run_command('view::Toggle_Chat')
    expect(home_view.value).toBe('tui')
    mock_route.path = '/'
    await flush_promises()
    expect(home_view.value).toBe('thoughts')
  })

  it('disables the chat toggle on /chat and enables it on other pages', async () => {
    mock_route.path = '/chat'
    const page = await open()
    key_commands.run_command('view::Toggle_Chat')
    expect(home_view.value).toBe('chat')
    expect(page.findAll('#chat-panel button[data-chat-toggle]')).toHaveLength(1)
    expect(page.get('button[data-chat-toggle]').element.disabled).toBe(true)
    await page.get('textarea').trigger('keydown', { key: 'Escape' })
    expect(home_view.value).toBe('chat')

    mock_route.path = '/terminal'
    await flush_promises()
    expect(page.get('button[data-chat-toggle]').element.disabled).toBe(false)
    key_commands.run_command('view::Toggle_Chat')
    expect(home_view.value).toBe('tui')
  })

  it('shows site navigation and one chat toggle in the terminal header', async () => {
    mock_route.path = '/terminal'
    const page = await open()
    const terminal = page
      .findAll('section')
      .find(section => section.find('nav[aria-label="Site"]').exists())
    expect(terminal).toBeDefined()
    expect(terminal.findAll('button[data-chat-toggle]')).toHaveLength(1)
    expect(terminal.get('nav[aria-label="Site"]').text()).toContain('About')
  })

  it('does not offer a terminal switch beside chat on Thoughts', async () => {
    mock_route.path = '/'
    const page = await open()
    key_commands.run_command('view::Toggle_Chat')
    await flush_promises()
    expect(home_view.value).toBe('chat-thoughts')
    expect(page.find('button[data-side-toggle]').exists()).toBe(false)
  })

  it('ignores TUI layouts on a narrow screen', async () => {
    use_home_view().wide.value = false
    await open()
    key_commands.run_command('view::Layout_Tui')
    expect(home_view.value).toBe('thoughts')
  })
})
