import { describe, it, expect, vi } from 'vite-plus/test'
import { ref } from 'vue'

// tests/mocks/default.js auto-mocks vue-router for every spec.
vi.unmock('vue-router')

vi.mock('@/utils/serverless', () => ({
  current_user: ref(null),
  me: ref(null)
}))

const { default: router } = await import('@/router')
const { current_user, me } = await import('@/utils/serverless')
const { scrollBehavior } = router.options

describe('@/router', () => {
  const route_for = path => router.options.routes.find(r => r.path === path)

  it('makes /sign-on a page of its own', () => {
    expect(route_for('/sign-on').component).toBeTypeOf('function')
    expect(route_for('/sign-on').redirect).toBeUndefined()
  })

  it('shows the sign-on page to anyone not yet signed on', () => {
    current_user.value = null
    expect(route_for('/sign-on').beforeEnter({ query: {} })).toBe(true)
    current_user.value = { uid: 'u1' }
    me.value = {}
    expect(route_for('/sign-on').beforeEnter({ query: {} })).toBe(true)
    current_user.value = null
    me.value = null
  })

  it('sends someone already signed on where they were going', () => {
    current_user.value = { uid: 'u1' }
    me.value = { name: 'Scott Fryxell' }
    const enter = route_for('/sign-on').beforeEnter
    expect(enter({ query: {} })).toBe('/account')
    expect(enter({ query: { next: '/discover' } })).toBe('/discover')
    expect(enter({ query: { next: '//evil.example' } })).toBe('/account')
    current_user.value = null
    me.value = null
  })

  it('keeps someone signed on on the page when a terminal is waiting', () => {
    current_user.value = { uid: 'u1' }
    me.value = { name: 'Scott Fryxell' }
    const enter = route_for('/sign-on').beforeEnter
    expect(enter({ query: { cli: '53124', state: 's'.repeat(32) } })).toBe(true)
    expect(enter({ query: { cli: 'bad', state: 's'.repeat(32) } })).toBe(
      '/account'
    )
    current_user.value = null
    me.value = null
  })

  it('sends old /account?sign-in links to the sign-on page', () => {
    const enter = route_for('/account').beforeEnter
    expect(enter({ query: {} })).toBe(true)
    expect(enter({ query: { 'sign-in': '', next: '/discover' } })).toEqual({
      path: '/sign-on',
      query: { next: '/discover' }
    })
  })

  it('sends /sign-in to /sign-on', () => {
    expect(route_for('/sign-in').redirect({ query: { next: '/x' } })).toEqual({
      path: '/sign-on',
      query: { next: '/x' }
    })
  })

  it('restores a saved position', () => {
    const saved = { top: 240 }
    expect(scrollBehavior({ path: '/about' }, { path: '/' }, saved)).toBe(saved)
  })

  it('scrolls a hash into view', () => {
    const to = { path: '/docs', hash: '#install' }
    expect(scrollBehavior(to, { path: '/' }, null)).toEqual({
      el: '#install',
      behavior: 'smooth'
    })
  })

  it('keeps the scroll position between pricing tiers', () => {
    const to = { path: '/pricing/teams' }
    const from = { path: '/pricing/endorse' }
    expect(scrollBehavior(to, from, null)).toBe(false)
  })

  it('scrolls to the top when arriving at pricing from elsewhere', async () => {
    const to = { path: '/pricing/teams' }
    const position = await scrollBehavior(to, { path: '/' }, null)
    expect(position).toEqual({ top: 0 })
  })

  it('scrolls to the top on an ordinary navigation', async () => {
    const to = { path: '/about' }
    const position = await scrollBehavior(to, { path: '/docs' }, null)
    expect(position).toEqual({ top: 0 })
  })
})
