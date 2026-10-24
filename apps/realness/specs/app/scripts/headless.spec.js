import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

const spawned = vi.hoisted(() => [])
vi.mock('node:child_process', async original => {
  const real = await original()
  const spawn = (...args) => {
    spawned.push(args)
    return { kill: () => {} }
  }
  return { ...real, default: { ...real.default, spawn }, spawn }
})

const {
  devtools,
  launch_browser,
  make_profile,
  open_page,
  remove_profile,
  wait_for_driver
} = await import('../../../scripts/lib/headless.js')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('launch_browser', () => {
  it('starts a headless browser with debugging on the page', () => {
    launch_browser({
      chrome_path: '/chrome',
      target_url: 'http://x/page',
      profile_dir: '/profile',
      debug_port: 9999
    })
    const [command, args, options] = spawned.at(-1)
    expect(command).toBe('/chrome')
    expect(args).toContain('--headless=new')
    expect(args).toContain('--remote-debugging-port=9999')
    expect(args).toContain('--user-data-dir=/profile')
    expect(args.at(-1)).toBe('http://x/page')
    expect(options.stdio).toBe('ignore')
  })
})

describe('open_page', () => {
  it('connects to the page and enables the runtime', async () => {
    vi.stubGlobal('fetch', async url => {
      expect(url).toBe('http://127.0.0.1:9999/json/list')
      return {
        json: async () => [{ type: 'page', webSocketDebuggerUrl: 'ws://page' }]
      }
    })
    const sent = []
    vi.stubGlobal(
      'WebSocket',
      class {
        constructor() {
          queueMicrotask(() => this.onopen())
        }
        send(text) {
          const { id, method } = JSON.parse(text)
          sent.push(method)
          queueMicrotask(() =>
            this.onmessage({ data: JSON.stringify({ id, result: {} }) })
          )
        }
      }
    )
    const { evaluate } = await open_page(9999, 'test')
    expect(sent).toEqual(['Runtime.enable'])
    expect(typeof evaluate).toBe('function')
  })
})

describe('devtools', () => {
  it('reports page console only when asked', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const message = {
      data: JSON.stringify({
        method: 'Runtime.consoleAPICalled',
        params: { args: [{ value: 'hi' }, { description: 'obj' }] }
      })
    }
    const quiet = { send() {} }
    devtools(quiet, 'q')
    quiet.onmessage(message)
    expect(error).not.toHaveBeenCalled()
    const loud = { send() {} }
    devtools(loud, 'l', { page_console: true })
    loud.onmessage(message)
    expect(error).toHaveBeenCalledWith('l: console', 'hi obj')
  })

  it('prefers the exception description', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const socket = { send() {} }
    devtools(socket, 'x')
    socket.onmessage({
      data: JSON.stringify({
        method: 'Runtime.exceptionThrown',
        params: {
          exceptionDetails: {
            text: 'short',
            exception: { description: 'long' }
          }
        }
      })
    })
    expect(error).toHaveBeenCalledWith('x: page error', 'long')
  })
})

describe('profiles', () => {
  it('makes and removes a profile under artifacts', () => {
    const dir = make_profile('headless-test')
    expect(dir).toMatch(/artifacts.*headless-test-/)
    mkdirSync(path.join(dir, 'sub'))
    writeFileSync(path.join(dir, 'sub', 'f'), 'x')
    remove_profile(dir, 'test')
    expect(existsSync(dir)).toBe(false)
  })

  it('warns when the profile cannot be removed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    remove_profile('\0bad', 'test')
    expect(warn).toHaveBeenCalledWith('test: left profile dir behind at \0bad')
  })
})

describe('wait_for_driver', () => {
  it('returns once the driver is ready', async () => {
    let calls = 0
    await wait_for_driver(async () => ++calls > 1, {
      timeout_ms: 1000,
      poll_ms: 0
    })
    expect(calls).toBe(2)
  })

  it('gives up after the timeout', async () => {
    await expect(
      wait_for_driver(async () => false, { timeout_ms: 0, poll_ms: 0 })
    ).rejects.toThrow('poster driver never became ready')
  })
})
