import {
  afterEach as after_each,
  beforeEach as before_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'

const SCRIPTS = {
  include: () =>
    import('#root/tools/publish/renderer/static/scripts/include.js'),
  reveal: () => import('#root/tools/publish/renderer/static/scripts/reveal.js'),
  pwa: () => import('#root/tools/publish/renderer/static/scripts/pwa.js'),
  'live-reload': () =>
    import('#root/tools/publish/renderer/static/scripts/live-reload.js'),
  'plan-covers': () =>
    import('#root/tools/publish/renderer/static/scripts/plan-covers.js'),
  diagrams: () =>
    import('#root/tools/publish/renderer/static/scripts/diagrams.js')
}
const PARTS = '#root/tools/publish/renderer/static/scripts/parts.js'
const PLAN_DIAGRAMS =
  '#root/tools/publish/renderer/static/scripts/plan-diagrams.js'

/** Run a page script fresh, the way a page load does. */
const load = name => {
  vi.resetModules()
  return SCRIPTS[name]()
}

before_each(() => {
  document.body.innerHTML = ''
  delete document.documentElement.dataset.diagrams
  delete document.documentElement.dataset.site
})
after_each(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('include', () => {
  it('replaces each template with its partial, includes inside included too', async () => {
    const partials = {
      '/partials/header.html':
        '<header>Head <template src="/partials/nav.html"></template></header>',
      '/partials/nav.html': '<nav>Nav</nav>'
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async url => ({ text: async () => partials[url] }))
    )
    document.body.innerHTML =
      '<template src="/partials/header.html"></template>'
    const { include } = await load('include')
    await include(document)
    expect(document.querySelector('template')).toBeNull()
    expect(document.querySelector('header').textContent).toBe('Head Nav')
    expect(document.querySelector('header nav').textContent).toBe('Nav')
  })
})

describe('reveal', () => {
  it('toggles the panel a reveal link names, and ignores other clicks', async () => {
    document.body.innerHTML =
      '<a href="#more" data-reveal-target="more">More</a><a href="#none" data-reveal-target="none">None</a><section id="more" hidden></section>'
    await load('reveal')
    const panel = document.getElementById('more')
    panel.scrollIntoView = vi.fn()
    document.querySelector('[data-reveal-target="more"]').click()
    expect(panel.hidden).toBe(false)
    expect(panel.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    document.querySelector('[data-reveal-target="more"]').click()
    expect(panel.hidden).toBe(true)
    document.querySelector('[data-reveal-target="none"]').click()
    document.body.click()
    expect(panel.hidden).toBe(true)
  })
})

describe('pwa', () => {
  it('registers the worker on load and checks for updates when visible again', async () => {
    const registration = { update: vi.fn(async () => {}) }
    const register = vi.fn(async () => registration)
    const serviceWorker = Object.assign(new EventTarget(), {
      controller: {},
      register,
      getRegistration: vi.fn(async () => registration)
    })
    vi.stubGlobal('navigator', { ...navigator, serviceWorker })
    await load('pwa')
    window.dispatchEvent(new Event('load'))
    await vi.waitFor(() =>
      expect(register).toHaveBeenCalledWith('/service.worker.js')
    )
    await Promise.resolve()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalledTimes(1))
  })
})

describe('live-reload', () => {
  it('reloads once the build stamp changes, not on the first read or a failed one', async () => {
    vi.useFakeTimers()
    const stamps = ['one', 'one', null, 'two']
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const stamp = stamps.shift()
        if (stamp === null) throw new Error('offline')
        return { text: async () => stamp }
      })
    )
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })
    await load('live-reload')
    for (const expected of [0, 0, 0, 1]) {
      await vi.advanceTimersByTimeAsync(400)
      expect(reload).toHaveBeenCalledTimes(expected)
    }
  })
})

describe('plan-covers', () => {
  it('reveals at once when a page has no diagrams', async () => {
    document.documentElement.dataset.diagrams = 'pending'
    await load('plan-covers')
    expect(document.documentElement.dataset.diagrams).toBe('ready')
  })

  it('copies a plan diagram into its cover and reveals once it draws', async () => {
    document.documentElement.dataset.diagrams = 'pending'
    document.body.innerHTML =
      '<section><article><figure></figure><template><pre class="mermaid">a</pre></template></article></section>'
    vi.stubGlobal('requestAnimationFrame', callback => callback())
    await load('plan-covers')
    const cover = document.querySelector('figure > pre.mermaid')
    expect(cover).not.toBeNull()
    expect(document.documentElement.dataset.diagrams).toBe('pending')
    cover.append(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))
    await vi.waitFor(() =>
      expect(document.documentElement.dataset.diagrams).toBe('ready')
    )
  })
})

describe('diagrams', () => {
  it('draws diagrams, sizes them on the plans site, and marks the page ready', async () => {
    const draw_diagrams = vi.fn(async () => {})
    const size_diagrams = vi.fn()
    vi.doMock(PARTS, () => ({ draw_diagrams }))
    vi.doMock(PLAN_DIAGRAMS, () => ({ size_diagrams }))
    document.documentElement.dataset.site = 'plans'
    document.body.innerHTML =
      '<pre class="mermaid">a</pre><article><figure><pre class="mermaid">b</pre></figure></article>'
    await load('diagrams')
    const [drawn] = draw_diagrams.mock.calls[0]
    expect(drawn.map(node => node.textContent)).toEqual(['b', 'a'])
    expect(size_diagrams).toHaveBeenCalledWith(drawn)
    expect(document.documentElement.dataset.diagrams).toBe('ready')
    vi.doUnmock(PARTS)
    vi.doUnmock(PLAN_DIAGRAMS)
  })

  it('leaves a page without diagrams alone', async () => {
    await load('diagrams')
    expect(document.documentElement.dataset.diagrams).toBeUndefined()
  })
})
