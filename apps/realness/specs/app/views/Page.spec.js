import {
  afterEach as after_each,
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

vi.mock('@/utils/serverless', async () => {
  const { ref } = await import('vue')
  return { current_user: ref({ getIdToken: async () => 'token' }) }
})

vi.mock('@/utils/diagrams', () => ({
  draw_diagrams: vi.fn(async () => []),
  mark_diagrams: vi.fn()
}))

vi.mock('@/utils/vault-events', () => ({
  watch_vault: vi.fn(async () => () => {})
}))

import Page from '@/views/Page.vue'

enable_auto_unmount(after_each)

const PAGE = `<!doctype html><html itemtype="https://schema.org/WebPage"><head><link rel="stylesheet" href="/session-map.css" /></head><body><main>
  <template src="/partials/header.fragment"></template>
  <article><h1 itemprop="name">Sessions are how we recover our work</h1><section itemprop="articleBody"><p>What it does</p><pre class="mermaid">flowchart LR</pre></section></article>
  <script type="module" src="/scripts/pwa.js"></script>
</main></body></html>`

const at = hash => vi.stubGlobal('location', { hash })

const SHEET = "article[itemtype$='/WebPage'] h2 { color: red; }"

const respond = (text = PAGE, sheet = SHEET) => {
  const spy = vi.fn(async url => ({
    ok: true,
    status: 200,
    json: async () => ({ text: String(url).includes('.css') ? sheet : text })
  }))
  vi.stubGlobal('fetch', spy)
  return spy
}

after_each(() => vi.unstubAllGlobals())

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

const at_page = () =>
  mount(Page, { global: { stubs: { 'router-link': router_link_stub } } })

describe('@/views/Page', () => {
  it('shows the page body without the site chrome or its scripts', async () => {
    at('#Areas/Realness/pages/architecture.html')
    const fetch = respond()
    const page = at_page()
    await flush_promises()
    expect(fetch).toHaveBeenCalledWith(
      '/v1/vault/note?path=Areas%2FRealness%2Fpages%2Farchitecture.html',
      { headers: { authorization: 'Bearer token' } }
    )
    const section = page.get('section[itemprop="articleBody"]')
    expect(section.text()).toContain('What it does')
    expect(section.html()).not.toContain('pwa.js')
    expect(section.find('pre.mermaid').exists()).toBe(true)
    expect(page.find('nav[aria-label="Related"]').text()).toContain('Tools')
    expect(page.get('article').attributes('itemtype')).toBe(
      'https://schema.org/WebPage'
    )
    expect(page.get('article').attributes('aria-label')).toBe(
      'Sessions are how we recover our work'
    )
    expect(fetch).toHaveBeenCalledWith(
      '/v1/vault/note?path=Areas%2FRealness%2Fpages%2Fsession-map.css',
      { headers: { authorization: 'Bearer token' } }
    )
    const styles = [...document.head.querySelectorAll('style')]
    expect(styles.map(style => style.textContent).join('')).toContain(
      'color: red'
    )
  })

  it('shows a page whose article has no body section, as the session map has', async () => {
    at('#Areas/Realness/pages/session-map.html')
    respond(
      '<!doctype html><html itemtype="https://schema.org/WebPage"><body><article><header><h1 itemprop="name">Sessions</h1></header><section><h2>1. Who receives the work</h2></section></article><address>+1555</address></body></html>'
    )
    const page = at_page()
    await flush_promises()
    const body = page.get('section[itemprop="articleBody"]')
    expect(body.text()).toContain('Who receives the work')
    expect(body.html()).not.toContain('<address')
  })

  it('says when the link names no page, and when the vault has none', async () => {
    at('')
    respond()
    const empty = at_page()
    await flush_promises()
    expect(empty.text()).toContain('No page in the link.')

    at('#Areas/Realness/pages/missing.html')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    )
    const missing = at_page()
    await flush_promises()
    expect(missing.text()).toContain('That page is not here.')
  })
})
