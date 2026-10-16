import { mount } from '../../../src/app/terminal/terminal.js'
import { make_stage, mount_options } from './stage.js'

describe('terminal reconnects', () => {
  let env
  beforeEach(() => {
    env = make_stage()
  })
  afterEach(() => vi.unstubAllGlobals())

  /** Mount with a ticket endpoint that answers `responses` in order. */
  const run = async responses => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      const next = responses[Math.min(calls++, responses.length - 1)]
      if (next === 'drop') throw new TypeError('Failed to fetch')
      return {
        ok: next === 200,
        status: next,
        json: async () => ({ ticket: 't' })
      }
    })
    await mount(env.stage, { ...mount_options, actor: 'a1' })
    for (let i = 0; i < 10 && !env.sockets.length; i++) await env.settle(1)
    return { calls, sockets: env.sockets.length }
  }

  it('reattaches after drops and a 503', async () => {
    expect(await run(['drop', 'drop', 503, 200])).toEqual({
      calls: 4,
      sockets: 1
    })
  })

  it('stops on a refused ticket', async () => {
    expect(await run([401])).toEqual({ calls: 1, sockets: 0 })
    expect(env.timers).toHaveLength(0)
  })

  it('never reopens a closed terminal', async () => {
    const open = vi.fn(async () => {
      throw new Error('network dropped')
    })
    const terminal = await mount(env.stage, {
      ...mount_options,
      actor: 'a1',
      open
    })
    await new Promise(resolve => setImmediate(resolve))
    terminal.close()
    for (const callback of env.timers.splice(0)) await callback()
    await new Promise(resolve => setImmediate(resolve))
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('never retries when closed while opening', async () => {
    let reject_open
    const terminal = await mount(env.stage, {
      ...mount_options,
      actor: 'a1',
      open: () =>
        new Promise((_, reject) => {
          reject_open = reject
        })
    })
    terminal.close()
    reject_open(new Error('closed while opening'))
    await new Promise(resolve => setImmediate(resolve))
    expect(env.timers).toHaveLength(0)
  })

  describe('when the tab comes back into view', () => {
    beforeEach(() => {
      document.visibilityState = 'hidden'
    })
    const show = async () => {
      document.visibilityState = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
      await new Promise(resolve => setImmediate(resolve))
    }

    it('retries at once instead of waiting on a held-back timer', async () => {
      const open = vi
        .fn()
        .mockRejectedValueOnce(new Error('host waking'))
        .mockImplementation(async () => new WebSocket('wss://gate/pty'))
      await mount(env.stage, { ...mount_options, actor: 'a1', open })
      await new Promise(resolve => setImmediate(resolve))
      expect(open).toHaveBeenCalledTimes(1)
      expect(env.timers.length).toBeGreaterThan(0)
      await show()
      expect(open).toHaveBeenCalledTimes(2)
      expect(env.sockets).toHaveLength(1)
    })

    it('never opens a second socket while one is opening or open', async () => {
      let finish
      const open = vi
        .fn()
        .mockRejectedValueOnce(new Error('host waking'))
        .mockImplementation(() => new Promise(resolve => (finish = resolve)))
      await mount(env.stage, { ...mount_options, actor: 'a1', open })
      await new Promise(resolve => setImmediate(resolve))
      await show()
      await show()
      expect(open).toHaveBeenCalledTimes(2)
      finish(new WebSocket('wss://gate/pty'))
      await new Promise(resolve => setImmediate(resolve))
      await show()
      expect(open).toHaveBeenCalledTimes(2)
      expect(env.sockets).toHaveLength(1)
    })

    it('leaves a terminal another tab took', async () => {
      const open = vi.fn(async () => new WebSocket('wss://gate/pty'))
      await mount(env.stage, { ...mount_options, actor: 'a1', open })
      await new Promise(resolve => setImmediate(resolve))
      const [socket] = env.sockets
      socket.onmessage({ data: JSON.stringify({ op: 'taken' }) })
      socket.onclose()
      await show()
      expect(open).toHaveBeenCalledTimes(1)
    })
  })
})
