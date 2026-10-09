import {
  afterEach as after_each,
  beforeEach as before_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'

vi.mock('@/utils/serverless', async () => {
  const { ref } = await import('vue')
  return { current_user: ref({ uid: 'me' }) }
})

import { current_user } from '@/utils/serverless'
import { fit_view, use_home_view } from '@/use/home-view'
import { home_view } from '@/utils/preference'

describe('@/use/home-view', () => {
  let views
  before_each(() => {
    views = use_home_view()
    current_user.value = { uid: 'me' }
    home_view.value = 'thoughts'
    views.wide.value = true
  })
  after_each(() => {
    home_view.value = 'thoughts'
  })

  it('fits a wanted view to the screen', () => {
    expect(fit_view('chat-tui', true)).toBe('chat-tui')
    expect(fit_view('chat-tui', false)).toBe('chat')
    expect(fit_view('chat-thoughts', false)).toBe('chat')
    expect(fit_view('tui', false)).toBe('thoughts')
    expect(fit_view('nonsense', true)).toBe('thoughts')
    expect(fit_view(undefined, false)).toBe('thoughts')
  })

  it('switches the side beside chat between thoughts and the terminal', () => {
    views.set_view('chat-thoughts')
    views.toggle_side()
    expect(views.view.value).toBe('chat-tui')
    expect(views.shows.value).toEqual({
      thoughts: false,
      chat: true,
      tui: true
    })
    views.toggle_side()
    expect(views.view.value).toBe('chat-thoughts')
  })

  it('on a narrow screen, chat covers thoughts and the TUI never shows', () => {
    views.wide.value = false
    views.toggle_chat()
    expect(views.view.value).toBe('chat')
    expect(views.shows.value).toEqual({
      thoughts: false,
      chat: true,
      tui: false
    })
    views.toggle_chat()
    expect(views.view.value).toBe('thoughts')
    expect(views.views.value).toEqual(['thoughts', 'chat'])
  })

  it('brings chat in or out beside what is showing', () => {
    views.toggle_chat()
    expect(views.view.value).toBe('chat-thoughts')
    views.toggle_chat()
    expect(views.view.value).toBe('thoughts')
    views.set_view('tui')
    views.toggle_chat()
    expect(views.view.value).toBe('chat-tui')
    views.toggle_chat()
    expect(views.view.value).toBe('tui')
  })

  it('shows only thoughts when signed out', () => {
    home_view.value = 'chat-tui'
    current_user.value = null
    expect(views.view.value).toBe('thoughts')
    expect(views.views.value).toEqual(['thoughts'])
  })
})
