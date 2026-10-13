import {
  afterEach as after_each,
  beforeEach as before_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'
import {
  choose_actor,
  gate_api,
  open_terminal,
  start_actor
} from '@/utils/brayness-gate'

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

  it('reports real startup events before actor readiness and preserves correlation', async () => {
    let controller
    let observed
    const progress_seen = new Promise(resolve => {
      observed = resolve
    })
    const body = new ReadableStream({
      start(value) {
        controller = value
      }
    })
    fetch.mockResolvedValueOnce(new Response(body))
    const events = []
    const starting = start_actor(user, {
      on_progress: event => {
        events.push(event)
        observed()
      }
    })
    const opening = {
      type: 'startup-stage',
      startup_id: 'startup-1',
      stage: 'starting_actor',
      state: 'starting',
      sequence: 1
    }
    const encoded = `${JSON.stringify(opening)}\n`
    controller.enqueue(new TextEncoder().encode(encoded.slice(0, 20)))
    controller.enqueue(new TextEncoder().encode(encoded.slice(20)))
    await progress_seen
    expect(events).toEqual([opening])
    controller.enqueue(
      new TextEncoder().encode(
        `${JSON.stringify({ type: 'actor-ready', startup_id: 'startup-1', actor_id: 'a-new', created: true, sequence: 2 })}\n`
      )
    )
    controller.close()
    expect(await starting).toEqual({
      id: 'a-new',
      created: true,
      startup_id: 'startup-1'
    })
    expect(fetch.mock.calls[0][0]).toBe('https://gate.test/v1/startup')
    expect(fetch.mock.calls[0][1].headers.authorization).toBe('Bearer id.token')
  })

  it('rejoins with the server startup ID and passes cancellation to fetch', async () => {
    const controller = new AbortController()
    fetch.mockResolvedValueOnce(
      new Response(
        `${JSON.stringify({ type: 'actor-ready', startup_id: 'startup-1', actor_id: 'a-existing', created: false })}\n`
      )
    )
    await start_actor(user, {
      startup_id: 'startup-1',
      actor: 'a-existing',
      signal: controller.signal
    })
    const init = fetch.mock.calls[0][1]
    expect(JSON.parse(init.body)).toEqual({
      startup_id: 'startup-1',
      actor: 'a-existing'
    })
    expect(init.signal).toBe(controller.signal)
  })

  it('keeps the correlation ID when startup fails or the stream ends early', async () => {
    fetch.mockResolvedValueOnce(
      new Response(
        `${JSON.stringify({ type: 'error', startup_id: 'startup-1', text: 'Actor startup failed' })}\n`
      )
    )
    await expect(start_actor(user)).rejects.toMatchObject({
      message: 'Actor startup failed',
      startup_id: 'startup-1'
    })
    fetch.mockResolvedValueOnce(
      new Response(
        `${JSON.stringify({ type: 'startup', startup_id: 'startup-2' })}\n`
      )
    )
    await expect(start_actor(user)).rejects.toMatchObject({
      startup_id: 'startup-2',
      message: 'Startup progress ended before the actor was ready'
    })
  })

  it('refuses an unexpected correlation change', async () => {
    fetch.mockResolvedValueOnce(
      new Response(
        `${JSON.stringify({ type: 'actor-ready', startup_id: 'another-startup' })}\n`
      )
    )
    await expect(
      start_actor(user, { startup_id: 'startup-1' })
    ).rejects.toMatchObject({
      message: 'Startup progress changed identity',
      startup_id: 'startup-1'
    })
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
