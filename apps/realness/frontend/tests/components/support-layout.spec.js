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
import {
  createMemoryHistory as create_memory_history,
  createRouter as create_router,
  RouterView,
  RouterLink
} from 'vue-router'
import SupportLayout from '@/components/support-layout.vue'
import { key_commands_plugin } from '@/plugins/key-commands'
import { current_user } from '@/utils/serverless'
import { home_view } from '@/utils/preference'
import { wide } from '@/use/home-view'

vi.mock('vue-router', async () => await vi.importActual('vue-router'))

vi.mock('@/utils/serverless', async () => {
  const { ref } = await import('vue')
  return {
    current_user: ref({ getIdToken: async () => 'id.token' }),
    me: ref(null)
  }
})

enable_auto_unmount(after_each)
const ndjson = (...records) =>
  new Response(records.map(record => `${JSON.stringify(record)}\n`).join(''), {
    headers: { 'content-type': 'application/x-ndjson' }
  })
let requests
before_each(() => {
  current_user.value = { getIdToken: async () => 'id.token' }
  home_view.value = 'thoughts'
  wide.value = true
  vi.stubEnv('MODE', 'development')
  requests = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options) => {
      requests.push({ url, options })
      if (url.endsWith('/v1/startup'))
        return ndjson(
          { type: 'startup', startup_id: 'support-startup', sequence: 0 },
          {
            type: 'actor-ready',
            startup_id: 'support-startup',
            sequence: 1,
            actor_id: 'a-mine00000000',
            created: false
          }
        )
      if (url.endsWith('/chat/events'))
        return ndjson({ type: 'history', messages: [] })
      if (url.endsWith('/chat/message')) return new Response('')
      throw new Error(`Unexpected request: ${url}`)
    })
  )
})
after_each(() => {
  home_view.value = 'thoughts'
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const open = async () => {
  const router = create_router({
    history: create_memory_history(),
    routes: [
      {
        path: '/docs',
        component: {
          template:
            '<article><h1>Documentation</h1><p>Poster controls</p><input value="private draft" /></article>'
        },
        meta: { support: true }
      },
      {
        path: '/about',
        component: {
          template: '<article><h1>About</h1><p>Realness</p></article>'
        },
        meta: { support: true }
      },
      { path: '/:pathMatch(.*)*', component: { template: '<article />' } }
    ]
  })
  await router.push('/docs')
  await router.isReady()
  const page = mount(SupportLayout, {
    attachTo: document.body,
    global: {
      plugins: [router, key_commands_plugin],
      stubs: {
        AsTui: true,
        LogoAsLink: true,
        'router-view': RouterView,
        'router-link': RouterLink
      }
    }
  })
  await flush_promises()
  return { page, router }
}

describe('app-wide chat', () => {
  it('opens beside documentation, keeps its draft and actor on navigation, and sends the new page context', async () => {
    const { page, router } = await open()
    await page.get('button[aria-label="Open chat"]').trigger('click')
    await flush_promises()
    expect(router.currentRoute.value.path).toBe('/docs')
    const input = page.get('textarea[name="message"]')
    await input.setValue('Explain this page')
    await router.push('/about')
    await flush_promises()
    expect(page.get('textarea').element).toBe(input.element)
    expect(input.element.value).toBe('Explain this page')
    expect(page.find('form output[aria-label="Page context"]').exists()).toBe(
      false
    )
    await page.get('form[data-chat]').trigger('submit')
    await flush_promises()
    const sent = JSON.parse(
      requests.find(request => request.url.endsWith('/chat/message')).options
        .body
    ).message
    expect(sent).toContain('/about')
    expect(sent).toContain('Realness')
    expect(sent).not.toContain('Poster controls')
    expect(sent).toContain('Explain this page')
    expect(
      requests.filter(request => request.url.endsWith('/chat/events'))
    ).toHaveLength(1)
    expect(
      requests.filter(request => request.url.endsWith('/v1/startup'))
    ).toHaveLength(1)
  })

  it('opens with Option+` while typing, then restores focus when closed', async () => {
    const { page, router } = await open()
    const previous = page.get('input')
    previous.element.focus()
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'Backquote',
        key: '`',
        altKey: true,
        cancelable: true
      })
    )
    await flush_promises()
    expect(router.currentRoute.value.path).toBe('/docs')
    expect(document.activeElement).toBe(page.get('textarea').element)
    await page.get('textarea').trigger('keydown', { key: 'Escape' })
    await flush_promises()
    expect(document.activeElement).toBe(previous.element)
  })

  it('keeps the chat control on the page when chat is beside it', async () => {
    const { page } = await open()
    await page.get('button[aria-label="Open chat"]').trigger('click')
    await flush_promises()
    expect(page.find('#chat-panel > header [data-chat-toggle]').exists()).toBe(
      false
    )
    expect(
      page
        .find('section[aria-label="Current page"] [data-chat-toggle]')
        .exists()
    ).toBe(true)
  })

  it('keeps a close control when chat covers the page on a narrow screen', async () => {
    wide.value = false
    const { page } = await open()
    await page.get('button[aria-label="Open chat"]').trigger('click')
    await flush_promises()
    await page.get('#chat-panel > header [data-chat-toggle]').trigger('click')
    await flush_promises()
    expect(page.get('#chat-panel').attributes('data-open')).toBeUndefined()
    expect(
      page.get('section[aria-label="Current page"]').attributes('inert')
    ).toBeUndefined()
  })

  it('does not offer a connected workspace when signed out', async () => {
    current_user.value = null
    const { page } = await open()
    expect(page.find('#chat-panel').exists()).toBe(false)
    expect(page.find('button[aria-label="Open chat"]').exists()).toBe(false)
    expect(requests).toHaveLength(0)
  })
})
