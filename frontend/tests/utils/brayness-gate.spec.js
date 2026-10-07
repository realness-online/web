import {
  afterEach as after_each,
  beforeEach as before_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'
import { choose_actor, gate_api, open_terminal } from '@/utils/brayness-gate'

const user = { getIdToken: async () => 'id.token' }
let calls, actors

before_each(() => {
  vi.stubEnv('VITE_BRAYNESS_GATE_URL', 'https://gate.test/')
  calls = []
  actors = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      calls.push({ url, method: init.method ?? 'GET', init })
      if (url.endsWith('/v1/missing')) return new Response('', { status: 404 })
      if (init.method === 'POST')
        return new Response(JSON.stringify({ id: 'a-new000000000' }), {
          status: 201
        })
      return new Response(JSON.stringify({ actors }))
    })
  )
})

after_each(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('brayness gate', () => {
  it('calls the host API through the gate with the Firebase token', async () => {
    await gate_api(user, '/v1/actors')
    expect(calls[0].url).toBe('https://gate.test/v1/actors')
    expect(calls[0].init.headers.authorization).toBe('Bearer id.token')
  })

  it('keeps the status on a refusal so callers can stop retrying', async () => {
    await expect(gate_api(user, '/v1/missing')).rejects.toMatchObject({
      status: 404
    })
  })

  it('reuses the most recently used actor', async () => {
    actors = [
      { id: 'a-old000000000', created: '2026-10-01T00:00:00Z' },
      {
        id: 'a-used00000000',
        created: '2026-09-01T00:00:00Z',
        last_activity: '2026-10-06T00:00:00Z'
      }
    ]
    expect(await choose_actor(user)).toEqual({
      id: 'a-used00000000',
      created: false
    })
    expect(calls).toHaveLength(1)
  })

  it('creates an actor when the person has none', async () => {
    expect(await choose_actor(user)).toEqual({
      id: 'a-new000000000',
      created: true
    })
    expect(calls.map(call => call.method)).toEqual(['GET', 'POST'])
  })

  it('opens the terminal on wss with the token as a subprotocol', async () => {
    const opened = []
    vi.stubGlobal(
      'WebSocket',
      class {
        constructor(url, protocols) {
          opened.push({ url: String(url), protocols })
        }
      }
    )
    await open_terminal(user, 'a-0123456789ab', { cols: 100, rows: 30 })
    expect(opened).toEqual([
      {
        url: 'wss://gate.test/pty?actor=a-0123456789ab&cols=100&rows=30',
        protocols: ['brayness', 'id.token']
      }
    ])
  })

  it('refuses before connecting when there is no token', async () => {
    await expect(
      open_terminal({ getIdToken: async () => '' }, 'a', { cols: 1, rows: 1 })
    ).rejects.toMatchObject({ status: 401 })
  })
})
