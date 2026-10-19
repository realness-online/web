import {
  afterEach as after_each,
  beforeEach as before_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'
import { create_vm_env } from '@/utils/vm-env'

const user = { getIdToken: vi.fn(async () => 'person-token') }
const context = {}
const exit = { type: 'exit', exit_code: 0 }
const actor = 'a-test00000000'
const encode = frames =>
  new TextEncoder().encode(
    frames.map(frame => `${JSON.stringify(frame)}\n`).join('')
  )
const reply = frames => new Response(encode(frames))
const output = (stream, bytes) => ({
  type: 'output',
  stream,
  data_b64: btoa(String.fromCharCode(...bytes))
})
const stdout = text => output('stdout', new TextEncoder().encode(text))
const ready = () =>
  reply([{ type: 'actor-ready', actor_id: actor, startup_id: 'startup-1' }])

before_each(() => {
  vi.stubEnv('MODE', 'development')
  vi.stubGlobal(
    'fetch',
    vi.fn(async url => (url.endsWith('/v1/startup') ? ready() : reply([exit])))
  )
  vi.clearAllMocks()
})
after_each(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('the browser VM environment', () => {
  it('does no I/O during environment creation', () => {
    const env = create_vm_env(user)
    expect(env.cwd).toBe('/realness')
    expect(fetch).not.toHaveBeenCalled()
    expect(user.getIdToken).not.toHaveBeenCalled()
  })

  it('wakes before exec, pins the actor, and refreshes the bearer each call', async () => {
    const env = create_vm_env(user, { cwd: '/realness/work/site' })
    await env.exec('pwd', {}, context)
    await env.exec(['printf', 'a b', ''], { cwd: '/realness' }, context)
    const calls = fetch.mock.calls
    expect(calls.map(([url]) => new URL(url).pathname)).toEqual([
      '/v1/startup',
      `/v1/actors/${actor}/exec`,
      '/v1/startup',
      `/v1/actors/${actor}/exec`
    ])
    expect(JSON.parse(calls[1][1].body)).toEqual({
      argv: ['/bin/bash', '-c', 'pwd'],
      cwd: '/realness/work/site',
      timeout: 0,
      stream: true
    })
    expect(JSON.parse(calls[2][1].body)).toEqual({ actor })
    expect(JSON.parse(calls[3][1].body).argv).toEqual(['printf', 'a b', ''])
    expect(
      calls.every(
        ([, init]) => init.headers.authorization === 'Bearer person-token'
      )
    ).toBe(true)
    expect(user.getIdToken).toHaveBeenCalledTimes(4)
  })

  it('forwards environment, timeout and spill options without rewriting the command', async () => {
    const env = create_vm_env(user, { actor })
    await env.exec(
      'echo "$NAME"',
      {
        env: { NAME: "a' b" },
        inheritEnv: false,
        timeout: 4,
        spill: { afterBytes: 1024, afterLines: 20 },
        window: {
          maxBytes: 100,
          maxLines: 2,
          minIntervalMs: 10,
          bytesPerSecond: 100
        }
      },
      context
    )
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      argv: ['/bin/bash', '-c', 'echo "$NAME"'],
      cwd: '/realness',
      env: { NAME: "a' b" },
      inherit_env: false,
      timeout: 4,
      spill: { afterBytes: 1024, afterLines: 20 },
      stream: true
    })
  })

  it('delivers output before exit, preserving split Unicode in each pipe', async () => {
    let stream
    let observed
    const early = new Promise(resolve => {
      observed = resolve
    })
    fetch.mockResolvedValueOnce(ready()).mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            stream = controller
          }
        })
      )
    )
    const chunks = []
    const env = create_vm_env(user)
    const pending = env.exec(
      'command',
      {
        onOutput: (text, ctx, info) => {
          chunks.push({ text, ctx, info })
          observed()
        }
      },
      context
    )
    const bytes = new TextEncoder().encode('A\u20ac')
    const frames = encode([
      output('stdout', bytes.slice(0, 2)),
      output('stderr', new TextEncoder().encode('error')),
      output('stdout', bytes.slice(2))
    ])
    stream.enqueue(frames.slice(0, 17))
    stream.enqueue(frames.slice(17))
    await early
    expect(chunks[0]).toEqual({
      text: 'A',
      ctx: context,
      info: { stream: 'stdout' }
    })
    stream.enqueue(
      encode([
        {
          type: 'exit',
          exit_code: 7,
          spill_path: '/realness/artifacts/realness/exec.log'
        }
      ])
    )
    stream.close()
    expect(await pending).toEqual({
      ok: true,
      value: { exitCode: 7, spillPath: '/realness/artifacts/realness/exec.log' }
    })
    expect(chunks.map(chunk => [chunk.text, chunk.info.stream])).toEqual([
      ['A', 'stdout'],
      ['error', 'stderr'],
      ['\u20ac', 'stdout']
    ])
  })

  it.each(['timeout', 'spawn_error', 'unknown'])(
    'returns the remote %s error with its spill path',
    async code => {
      fetch.mockResolvedValueOnce(ready()).mockResolvedValueOnce(
        reply([
          {
            type: 'exit',
            exit_code: 124,
            error: code,
            spill_path: '/realness/artifacts/realness/exec.log'
          }
        ])
      )
      const result = await create_vm_env(user).exec('command', {}, context)
      expect(result).toMatchObject({
        ok: false,
        error: { code, spillPath: '/realness/artifacts/realness/exec.log' }
      })
    }
  )

  it('keeps an ordinary exit 124 as an exit status', async () => {
    fetch
      .mockResolvedValueOnce(ready())
      .mockResolvedValueOnce(reply([{ type: 'exit', exit_code: 124 }]))
    expect(await create_vm_env(user).exec('exit 124', {}, context)).toEqual({
      ok: true,
      value: { exitCode: 124 }
    })
  })

  it.each(
    [
      [],
      [stdout('partial')],
      [{ type: 'exit', exit_code: '0' }],
      [{ type: 'output', stream: 'invalid', data_b64: '' }],
      [{ type: 'invalid' }]
    ].map(frames => ({ frames }))
  )(
    'refuses a broken stream instead of reporting success',
    async ({ frames }) => {
      fetch.mockResolvedValueOnce(ready()).mockResolvedValueOnce(reply(frames))
      expect(
        await create_vm_env(user).exec('command', {}, context)
      ).toMatchObject({ ok: false, error: { code: 'unknown' } })
      expect(fetch).toHaveBeenCalledTimes(2)
    }
  )

  it('does not retry an unsafe command after a dropped connection', async () => {
    fetch
      .mockResolvedValueOnce(ready())
      .mockRejectedValueOnce(new Error('connection lost'))
    expect(
      await create_vm_env(user).exec('touch file', {}, context)
    ).toMatchObject({
      ok: false,
      error: { code: 'unknown', message: 'connection lost' }
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('returns startup failures without sending a command', async () => {
    fetch.mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
    expect(
      await create_vm_env(user).exec('command', {}, context)
    ).toMatchObject({
      ok: false,
      error: { code: 'unknown', message: 'unavailable' }
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('refuses an actor change before executing', async () => {
    expect(
      await create_vm_env(user, { actor: 'a-other' }).exec(
        'command',
        {},
        context
      )
    ).toMatchObject({
      ok: false,
      error: { message: 'Command startup changed actor' }
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('cancels only the requested command and permits another operation', async () => {
    const running = []
    fetch.mockImplementation(async (url, init) => {
      if (url.endsWith('/v1/startup')) return ready()
      return new Response(
        new ReadableStream({
          start(controller) {
            running.push({ controller, signal: init.signal })
            init.signal.addEventListener(
              'abort',
              () => controller.error(new DOMException('stopped', 'AbortError')),
              { once: true }
            )
          }
        })
      )
    })
    const env = create_vm_env(user, { actor })
    const abort = new AbortController()
    const first = env.exec('first', {}, { abortSignal: abort.signal })
    const second = env.exec('second', {}, context)
    await vi.waitFor(() => expect(running).toHaveLength(2))
    abort.abort()
    expect(await first).toMatchObject({ ok: false, error: { code: 'aborted' } })
    expect(running[1].signal.aborted).toBe(false)
    running[1].controller.enqueue(encode([exit]))
    running[1].controller.close()
    expect(await second).toEqual({ ok: true, value: { exitCode: 0 } })
  })

  it('cleanup waits for its active commands to stop', async () => {
    let active
    fetch.mockResolvedValueOnce(ready()).mockImplementationOnce(
      async (url, init) =>
        new Response(
          new ReadableStream({
            start(controller) {
              active = init.signal
              init.signal.addEventListener(
                'abort',
                () =>
                  controller.error(new DOMException('stopped', 'AbortError')),
                { once: true }
              )
            }
          })
        )
    )
    const env = create_vm_env(user)
    const pending = env.exec('command', {}, context)
    await vi.waitFor(() => expect(active).toBeDefined())
    await env.cleanup()
    expect(await pending).toMatchObject({
      ok: false,
      error: { code: 'aborted' }
    })
    expect(active.aborted).toBe(true)
  })

  it('does no I/O for an already cancelled context', async () => {
    const abort = new AbortController()
    abort.abort()
    expect(
      await create_vm_env(user).exec(
        'command',
        {},
        { abortSignal: abort.signal }
      )
    ).toMatchObject({ ok: false, error: { code: 'aborted' } })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('aborts the request when the output callback fails', async () => {
    fetch
      .mockResolvedValueOnce(ready())
      .mockResolvedValueOnce(reply([stdout('one'), exit]))
    const result = await create_vm_env(user).exec(
      'command',
      {
        onOutput: () => {
          throw new Error('callback broke')
        }
      },
      context
    )
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'callback_error' }
    })
    expect(fetch.mock.calls[1][1].signal.aborted).toBe(true)
  })
})
