import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { realness_sign_in } from '@/utils/realness-sign-in'

const b64 = value =>
  btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
const token = (exp_seconds, sub = 'r-uid') =>
  `h.${b64({ sub, exp: exp_seconds, phone_number: '+16282281824' })}.s`
const in_seconds = seconds => Math.floor(Date.now() / 1000) + seconds

const service = () => {
  const calls = []
  const replies = {
    '/code': () => ({ status: 202, body: { sent: true } }),
    '/token': () => ({
      status: 200,
      body: { id_token: token(in_seconds(3600)), refresh_token: 'refresh-1' }
    }),
    '/refresh': () => ({
      status: 200,
      body: { id_token: token(in_seconds(3600), 'r-uid') }
    }),
    '/sign-out': () => ({ status: 204, body: null })
  }
  globalThis.fetch = vi.fn(async (url, init) => {
    const path = url.replace('/sign-in', '')
    calls.push({ path, body: JSON.parse(init.body) })
    const { status, body } = replies[path]()
    return {
      ok: status < 400,
      status,
      json: async () => body
    }
  })
  return { calls, replies }
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('realness sign-in', () => {
  it('starts signed out', () => {
    service()
    const seen = []
    realness_sign_in('/sign-in').on_change(user => seen.push(user))
    expect(seen).toEqual([null])
  })

  it('a code signs in and the user looks like a Firebase user', async () => {
    const { calls } = service()
    const auth = realness_sign_in('/sign-in')
    const seen = []
    auth.on_change(user => seen.push(user))
    const pending = await auth.sign_in('+16282281824')
    expect(calls[0]).toEqual({
      path: '/code',
      body: { phone: '+16282281824' }
    })
    await pending.confirm('123456')
    const user = seen.at(-1)
    expect(user.uid).toBe('r-uid')
    expect(user.phoneNumber).toBe('+16282281824')
    expect(await user.getIdToken()).toMatch(/^h\./)
    expect(calls.map(call => call.path)).toEqual(['/code', '/token'])
  })

  it('a formatted number goes out as digits only', async () => {
    const { calls } = service()
    await (
      await realness_sign_in('/sign-in').sign_in('+1(628) 228-1824')
    ).confirm('1')
    expect(calls.map(call => call.body.phone)).toEqual([
      '+16282281824',
      '+16282281824'
    ])
  })

  it('a reload keeps the session and renews the token', async () => {
    const { calls } = service()
    await (
      await realness_sign_in('/sign-in').sign_in('+16282281824')
    ).confirm('1')
    let user = null
    realness_sign_in('/sign-in').on_change(next => (user = next))
    expect(user.phoneNumber).toBe('+16282281824')
    await user.getIdToken()
    expect(calls.at(-1)).toEqual({
      path: '/refresh',
      body: { refresh_token: 'refresh-1' }
    })
  })

  it('signing out clears the session and tells the service', async () => {
    const { calls } = service()
    const auth = realness_sign_in('/sign-in')
    await (await auth.sign_in('+16282281824')).confirm('1')
    const seen = []
    auth.on_change(user => seen.push(user))
    await auth.sign_out()
    expect(seen.at(-1)).toBeNull()
    expect(calls.at(-1).path).toBe('/sign-out')
    expect(localStorage.getItem('realness_session')).toBeNull()
  })

  it('a wrong code throws and stays signed out', async () => {
    const { replies } = service()
    replies['/token'] = () => ({ status: 401, body: { error: 'code' } })
    const auth = realness_sign_in('/sign-in')
    const pending = await auth.sign_in('+16282281824')
    await expect(pending.confirm('000000')).rejects.toThrow(/401/)
    let user = 'unset'
    auth.on_change(next => (user = next))
    expect(user).toBeNull()
  })
})
