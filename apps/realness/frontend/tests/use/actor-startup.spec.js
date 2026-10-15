import {
  afterEach as after_each,
  beforeEach as before_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'
import { ref } from 'vue'
import { use_actor_startup } from '@/use/actor-startup'

const user = ref({ getIdToken: async () => 'id.token' })
const working = vi.fn()
const stage = {
  type: 'startup-stage',
  startup_id: 'startup-1',
  actor_id: 'a-one',
  stage: 'restoring_files',
  state: 'starting',
  stage_index: 3,
  sequence: 7,
  elapsed_ms: 8400
}
const ready = {
  type: 'actor-ready',
  startup_id: 'startup-1',
  actor_id: 'a-one',
  created: false
}
const response = (...events) =>
  new Response(events.map(event => `${JSON.stringify(event)}\n`).join(''))

before_each(() => {
  vi.stubEnv('MODE', 'development')
  vi.stubGlobal('fetch', vi.fn())
  working.mockClear()
})
after_each(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('@/use/actor-startup', () => {
  it('shows the gate wake as progress without taking its correlation', async () => {
    const waking = {
      type: 'startup-stage',
      source: 'gate',
      stage: 'starting_host',
      state: 'starting',
      elapsed_ms: 1200
    }
    let controller
    fetch.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(value) {
            controller = value
          }
        })
      )
    )
    const startup = use_actor_startup(user, { set_working: working })
    const pending = startup.prepare()
    controller.enqueue(new TextEncoder().encode(`${JSON.stringify(waking)}\n`))
    await vi.waitFor(() =>
      expect(startup.progress.value?.stage).toBe('starting_host')
    )
    expect(startup.startup_id.value).toBe(null)
    controller.enqueue(new TextEncoder().encode(`${JSON.stringify(ready)}\n`))
    controller.close()
    await pending
    expect(startup.startup_id.value).toBe('startup-1')
  })

  it('shares a pending observer and does not expose the actor before readiness', async () => {
    let controller
    fetch.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(value) {
            controller = value
          }
        })
      )
    )
    const startup = use_actor_startup(user, { set_working: working })
    const first = startup.prepare()
    expect(startup.prepare()).toBe(first)
    controller.enqueue(new TextEncoder().encode(`${JSON.stringify(stage)}\n`))
    await vi.waitFor(() =>
      expect(startup.progress.value?.stage).toBe('restoring_files')
    )
    expect(startup.actor.value).toBe(null)
    expect(startup.finding.value).toBe(true)
    expect(startup.progress.value.elapsed_ms).toBe(8400)
    expect(working.mock.calls).toEqual([[true]])
    controller.enqueue(new TextEncoder().encode(`${JSON.stringify(ready)}\n`))
    controller.close()
    await first
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(startup.actor.value).toBe('a-one')
    expect(startup.finding.value).toBe(false)
    expect(working.mock.calls).toEqual([[true], [false]])
  })

  it('checks the actor again for a later connection instead of replaying stale readiness', async () => {
    fetch.mockResolvedValueOnce(response(ready))
    const startup = use_actor_startup(user)
    await startup.prepare('a-one')
    fetch.mockResolvedValueOnce(response({ ...ready, startup_id: 'startup-2' }))
    await startup.prepare('a-one')
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ actor: 'a-one' })
    expect(startup.startup_id.value).toBe('startup-2')
  })

  it('Retry rejoins an interrupted operation with its original startup ID', async () => {
    fetch.mockResolvedValueOnce(response(stage))
    const startup = use_actor_startup(user)
    await expect(startup.prepare()).rejects.toThrow('ended before')
    expect(startup.startup_id.value).toBe('startup-1')
    fetch.mockResolvedValueOnce(response(stage, ready))
    await startup.prepare()
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      startup_id: 'startup-1'
    })
    expect(startup.problem.value).toBe('')
  })

  it('starts a fresh operation when the saved replay ID has expired', async () => {
    fetch.mockResolvedValueOnce(response(stage))
    const startup = use_actor_startup(user)
    await expect(startup.prepare()).rejects.toThrow()
    fetch.mockResolvedValueOnce(new Response('', { status: 404 }))
    fetch.mockResolvedValueOnce(response({ ...ready, startup_id: 'startup-2' }))
    await startup.prepare('a-one')
    expect(JSON.parse(fetch.mock.calls[1][1].body).startup_id).toBe('startup-1')
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ actor: 'a-one' })
    expect(startup.startup_id.value).toBe('startup-2')
  })

  it('does not replay a terminal startup failure and keeps Retry available', async () => {
    fetch.mockResolvedValueOnce(
      response(stage, {
        type: 'error',
        startup_id: 'startup-1',
        text: 'Actor startup failed'
      })
    )
    const startup = use_actor_startup(user, { set_working: working })
    await expect(startup.prepare()).rejects.toThrow('Actor startup failed')
    expect(startup.startup_id.value).toBe(null)
    expect(startup.problem.value).toBe('Actor startup failed')
    fetch.mockResolvedValueOnce(response(ready))
    await startup.prepare()
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({})
    expect(working.mock.calls).toEqual([[true], [false], [true], [false]])
  })

  it('aborts its observer on close and releases shared working exactly once', async () => {
    fetch.mockImplementationOnce(
      (_, options) =>
        new Promise((_, reject) => {
          options.signal.addEventListener('abort', () =>
            reject(new DOMException('Closed', 'AbortError'))
          )
        })
    )
    const startup = use_actor_startup(user, { set_working: working })
    const preparing = startup.prepare()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    startup.stop()
    await expect(preparing).rejects.toMatchObject({ name: 'AbortError' })
    expect(working.mock.calls).toEqual([[true], [false]])
    expect(startup.problem.value).toBe('')
    expect(startup.actor.value).toBe(null)
  })
})
