import { describe, it, expect, vi } from 'vite-plus/test'
import { ref } from 'vue'

// tests/mocks/default.js auto-mocks vue-router for every spec.
vi.unmock('vue-router')

vi.mock('@/utils/serverless', () => ({
  current_user: ref(null),
  me: ref(null)
}))

const { default: router } = await import('@/router')
const { scrollBehavior } = router.options

describe('@/router', () => {
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
