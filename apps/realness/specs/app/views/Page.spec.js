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
import { note_html } from '#root/src/sync/vault-items.js'

enable_auto_unmount(after_each)

const PAGE = `<!doctype html><html itemtype="https://schema.org/WebPage"><head><link rel="stylesheet" href="/session-map.css" /></head><body><main>
  <template src="/partials/header.fragment"></template>
  <article><h1 itemprop="name">Sessions are how we recover our work</h1><section itemprop="articleBody"><p>What it does</p><pre class="mermaid">flowchart LR</pre></section></article>
</main></body></html>`

const at = hash => vi.stubGlobal('location', { hash })

const SHEET = "article[itemtype$='/WebPage'] h2 { color: red; }"

const respond = (text = PAGE, sheet = SHEET) => {
  const spy = vi.fn(async url => ({
    ok: true,
    status: 200,
    text: async () =>
      note_html({
        path: String(url),
        text: String(url).includes('.css') ? sheet : text
      })
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

  it('opens a page that carries a script as its own document', async () => {
    at('#Projects/realness-presentation/presentation.html')
    const deck =
      '<!doctype html><html><head><link rel="stylesheet" href="https://realness.online/palette.css" /></head><body><ol><li class="active"><iframe src="slide.html"></iframe></li></ol><script>addEventListener("keydown", () => {})</script></body></html>'
    respond(deck)
    const page = at_page()
    await flush_promises()
    const frame = page.get('iframe')
    expect(frame.attributes('srcdoc')).toContain('<script>')
    expect(frame.attributes('srcdoc')).toContain('/palette.css')
    expect(page.find('section[itemprop="articleBody"]').exists()).toBe(false)
    expect(page.find('nav[aria-label="Related"]').exists()).toBe(false)
  })

  it('writes the stylesheets and scripts a page keeps beside it into its frame', async () => {
    at('#Areas/Realness/pages/maps/modules.html')
    const map =
      '<!doctype html><html><head><link rel="stylesheet" href="https://realness.online/palette.css" /><link rel="stylesheet" href="maps.css" /></head><body><table></table><script type="module" src="modules.js"></script></body></html>'
    const files = {
      'modules.html': map,
      'maps.css': 'table { color: red; }',
      'modules.js': 'document.title = "$& filtered"'
    }
    const fetch = vi.fn(async url => {
      const path = decodeURIComponent(String(url).split('path=')[1])
      const name = path.split('/').at(-1)
      return {
        ok: true,
        status: 200,
        text: async () => note_html({ path, text: files[name] })
      }
    })
    vi.stubGlobal('fetch', fetch)
    const page = at_page()
    await flush_promises()
    const srcdoc = page.get('iframe').attributes('srcdoc')
    expect(fetch).toHaveBeenCalledWith(
      '/v1/vault/note?path=Areas%2FRealness%2Fpages%2Fmaps%2Fmodules.js',
      { headers: { authorization: 'Bearer token' } }
    )
    expect(srcdoc).toContain('<style>table { color: red; }</style>')
    expect(srcdoc).toContain(
      '<script type="module">document.title = "$& filtered"</script>'
    )
    expect(srcdoc).toContain('href="https://realness.online/palette.css"')
    expect(srcdoc).not.toContain('src="modules.js"')
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
