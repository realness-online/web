import {
  afterEach as after_each,
  beforeEach as before_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'
import { nextTick as next_tick, ref } from 'vue'
import { use_sign_on } from '#root/src/sign-on/browser/flow.js'

const load_push_handlers = () => {
  vi.resetModules()
  return import('../../../public/push-handlers.js')
}

const load_commands_page = () => {
  vi.resetModules()
  return import('../../../../../.pi/bin/harness/commands/page.js').then(
    module => module.wire_page(document)
  )
}

after_each(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('commands page', () => {
  const row = (title, review, command) =>
    `<li><header>${title}</header><strong>${review}</strong><details>${title} details</details><code></code><button value="${command}">Copy</button></li>`

  before_each(() => {
    document.body.innerHTML = `
      <input type="search">
      <output></output>
      <fieldset id="command-filters"><button value="all" aria-pressed="true">All</button><button value="Build" aria-pressed="false">Build</button></fieldset>
      <fieldset id="review-filters"><button value="all" aria-pressed="true">All</button><button value="Keep" aria-pressed="false">Keep</button></fieldset>
      <div id="command-list">
        <section><h2>Build</h2><ul>${row('Build site', 'Keep', 'npm run build')}${row('Watch', 'Drop', 'npm run watch')}</ul></section>
        <section><h2>Deploy</h2><ul>${row('Ship it', 'Keep', 'npm run ship')}</ul></section>
      </div>`
  })

  const shown = () =>
    [...document.querySelectorAll('li:not([hidden]) header')].map(
      h => h.textContent
    )

  it('counts every command at first, then filters by search, group, and review', async () => {
    await load_commands_page()
    const output = document.querySelector('output')
    expect(output.textContent).toBe('3 commands')

    const search = document.querySelector('input[type="search"]')
    search.value = 'ship'
    search.dispatchEvent(new Event('input'))
    expect(shown()).toEqual(['Ship it'])
    expect(output.textContent).toBe('1 command')
    expect(document.querySelectorAll('section')[0].hidden).toBe(true)

    search.value = ''
    document.querySelector('#command-filters [value="Build"]').click()
    expect(shown()).toEqual(['Build site', 'Watch'])
    document.querySelector('#review-filters [value="Keep"]').click()
    expect(shown()).toEqual(['Build site'])

    search.value = 'nothing like this'
    search.dispatchEvent(new Event('input'))
    expect(output.textContent).toBe('No commands found')
  })

  it('copies a command, then says so briefly', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    await load_commands_page()
    const button = document.querySelector('button[value="npm run ship"]')
    button.click()
    await vi.waitFor(() => expect(button.textContent).toBe('Copied'))
    expect(writeText).toHaveBeenCalledWith('npm run ship')
    vi.advanceTimersByTime(2000)
    expect(button.textContent).toBe('Copy')
  })

  it('selects the command for copying by hand when the clipboard refuses', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: vi.fn(async () => Promise.reject(new Error('no')))
      }
    })
    const range = { selectNodeContents: vi.fn() }
    vi.spyOn(document, 'createRange').mockReturnValue(range)
    const selection = { removeAllRanges: vi.fn(), addRange: vi.fn() }
    vi.spyOn(window, 'getSelection').mockReturnValue(selection)
    await load_commands_page()
    const button = document.querySelector('button[value="npm run build"]')
    button.click()
    await vi.waitFor(() => expect(button.textContent).toBe('Select to copy'))
    const code = button.parentElement.querySelector('code')
    expect(code.textContent).toBe('npm run build')
    expect(range.selectNodeContents).toHaveBeenCalledWith(code)
    expect(selection.addRange).toHaveBeenCalledWith(range)
  })
})

describe('push handlers', () => {
  let handlers, shown, windows, opened

  before_each(async () => {
    handlers = {}
    shown = vi.fn(async () => {})
    opened = vi.fn(async () => {})
    windows = []
    vi.stubGlobal('self', {
      addEventListener: (type, fn) => (handlers[type] = fn),
      registration: { showNotification: shown }
    })
    vi.stubGlobal('clients', {
      matchAll: vi.fn(async () => windows),
      openWindow: opened
    })
    await load_push_handlers()
  })

  const fire = async (type, event) => {
    let work
    handlers[type]({ ...event, waitUntil: promise => (work = promise) })
    await work
  }

  it('shows a push with its title and link, defaulting what it leaves out', async () => {
    await fire('push', {
      data: {
        json: () => ({
          title: 'New poster',
          body: 'Look',
          url: '/+1/posters/2'
        })
      }
    })
    expect(shown).toHaveBeenCalledWith('New poster', {
      body: 'Look',
      icon: '/192.png',
      badge: '/192.png',
      tag: undefined,
      data: { url: '/+1/posters/2' }
    })
    await fire('push', {
      data: {
        json: () => {
          throw new Error('not json')
        },
        text: () => 'plain words'
      }
    })
    expect(shown).toHaveBeenLastCalledWith(
      'Realness',
      expect.objectContaining({ body: 'plain words', data: { url: '/' } })
    )
  })

  it('focuses and moves an open window, or opens one', async () => {
    const close = vi.fn()
    const open_window = {
      url: 'https://realness.online/',
      focus: vi.fn(async () => {}),
      navigate: vi.fn(async () => {})
    }
    windows = [open_window]
    await fire('notificationclick', {
      notification: { close, data: { url: '/' } }
    })
    expect(close).toHaveBeenCalled()
    expect(open_window.focus).toHaveBeenCalled()
    expect(open_window.navigate).not.toHaveBeenCalled()

    windows = [{ url: 'https://realness.online/elsewhere', focus: vi.fn() }]
    await fire('notificationclick', {
      notification: { close, data: { url: '/+1/posters/2' } }
    })
    expect(opened).toHaveBeenCalledWith('/+1/posters/2')
  })
})

describe('sign-on flow', () => {
  const make = ({ user = null, valid = false, loaded = true } = {}) => {
    const emit = vi.fn()
    const profile = {
      loaded: ref(loaded),
      is_valid_name: ref(valid),
      load: vi.fn(async () => {
        profile.loaded.value = true
        return loaded
      }),
      save: vi.fn(async () => {})
    }
    const current_user = ref(user)
    return {
      emit,
      profile,
      current_user,
      flow: use_sign_on({ current_user, profile, emit })
    }
  }

  it('signs in at once when the profile already has a name', async () => {
    const { emit, flow } = make({ valid: true })
    expect(emit).toHaveBeenCalledWith('showing_mobile', true)
    await flow.on_signed_on()
    expect(emit).toHaveBeenCalledWith('signed_in')
    expect(flow.nameless.value).toBe(false)
  })

  it('asks for a name when there is none, then signs in once it is saved', async () => {
    const { emit, profile, flow } = make({ loaded: false })
    await flow.on_signed_on()
    expect(flow.nameless.value).toBe(true)
    await next_tick()
    expect(emit).toHaveBeenLastCalledWith('showing_mobile', false)
    await flow.on_name_valid()
    expect(profile.save).toHaveBeenCalled()
    expect(emit).toHaveBeenLastCalledWith('signed_in')
  })

  it('asks for a name when a signed-in user has none', () => {
    const { flow } = make({ user: { uid: 'u' } })
    expect(flow.nameless.value).toBe(true)
  })
})
