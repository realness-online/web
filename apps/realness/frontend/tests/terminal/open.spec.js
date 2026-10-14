import { mount } from '../../../src/app/terminal/terminal.js'
import { make_stage, mount_options } from './stage.js'

describe('terminal mounted with an open function', () => {
  let env
  beforeEach(() => {
    env = make_stage()
    vi.stubGlobal('fetch', async () => {
      throw new Error('no ticket fetch with open')
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('asks for a socket at the stage size', async () => {
    const asked = []
    await mount(env.stage, {
      ...mount_options,
      open: async size => (
        asked.push(size),
        new WebSocket('wss://gate.test/pty')
      )
    })
    await env.settle()
    expect(asked).toHaveLength(1)
    expect(asked[0].cols).toBeGreaterThanOrEqual(20)
    expect(asked[0].rows).toBeGreaterThanOrEqual(6)
  })

  it('close removes listeners and closes the socket', async () => {
    const terminal = await mount(env.stage, {
      ...mount_options,
      open: async () => new WebSocket('wss://gate.test/pty')
    })
    await env.settle()
    expect(env.listeners.size).toBeGreaterThan(0)
    const close = vi.fn()
    env.sockets[0].close = close
    terminal.close()
    expect(env.listeners.size).toBe(0)
    expect(close).toHaveBeenCalled()
  })

  it('stops after a refusal', async () => {
    const open = vi.fn(async () => {
      throw Object.assign(new Error('401'), { status: 401 })
    })
    await mount(env.stage, { ...mount_options, open })
    await env.settle()
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('retries a dropped network until it opens', async () => {
    let tries = 0
    await mount(env.stage, {
      ...mount_options,
      open: async () => {
        if (++tries < 3) throw new TypeError('network')
        return new WebSocket('wss://gate.test/pty')
      }
    })
    await env.settle()
    expect(tries).toBe(3)
  })
})
