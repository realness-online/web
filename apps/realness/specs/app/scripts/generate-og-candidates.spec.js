import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { artifacts_dir } from '../../../scripts/lib/artifacts.js'
import { main, preflight } from '../../../scripts/generate-og-candidates.js'
import {
  connect,
  devtools,
  page_socket_url,
  serve_dist
} from '../../../scripts/lib/headless.js'

let root
let dist_dir
let out_dir
let chrome_path
beforeEach(() => {
  mkdirSync(artifacts_dir, { recursive: true })
  root = mkdtempSync(path.join(artifacts_dir, 'og-test-'))
  dist_dir = path.join(root, 'dist')
  out_dir = path.join(root, 'out')
  chrome_path = path.join(root, 'chrome')
  mkdirSync(path.join(dist_dir, 'assets'), { recursive: true })
  writeFileSync(path.join(dist_dir, 'index.html'), '<main>app</main>')
  writeFileSync(path.join(dist_dir, 'assets', 'a.css'), 'p{}')
  writeFileSync(path.join(dist_dir, 'assets', 'blob.bin'), 'bin')
  writeFileSync(chrome_path, '')
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('preflight', () => {
  it('needs a build and a browser', () => {
    expect(() => preflight(dist_dir, chrome_path)).not.toThrow()
    expect(() => preflight(out_dir, chrome_path)).toThrow(/index.html missing/)
    expect(() => preflight(dist_dir, undefined)).toThrow(
      /CHROME_PATH is not set/
    )
    expect(() => preflight(dist_dir, `${chrome_path}-gone`)).toThrow(
      /CHROME_PATH not found/
    )
  })
})

/** GET over node:http, since the test setup replaces fetch. */
const get = (base, request_path) =>
  new Promise((resolve, reject) => {
    const { port } = new URL(base)
    http
      .get({ host: '127.0.0.1', port, path: request_path }, response => {
        let body = ''
        response.on('data', chunk => (body += chunk))
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            type: response.headers['content-type'],
            body
          })
        )
      })
      .on('error', reject)
  })

describe('serve_dist', () => {
  it('serves files with types and falls back to the app', async () => {
    const server = await serve_dist(dist_dir, 0)
    const base = `http://127.0.0.1:${server.address().port}`
    try {
      const css = await get(base, '/assets/a.css?v=1')
      expect(css).toEqual({ status: 200, type: 'text/css', body: 'p{}' })
      expect((await get(base, '/assets/blob.bin')).type).toBe(
        'application/octet-stream'
      )
      for (const route of ['/og-candidates', '/assets'])
        expect((await get(base, route)).body).toBe('<main>app</main>')
      expect((await get(base, '/%2e%2e/chrome')).status).toBe(404)
    } finally {
      server.close()
    }
  })
})

/** A socket that answers each devtools command from a table. */
const fake_socket = answers => {
  const socket = {
    sent: [],
    send(text) {
      const { id, method, params } = JSON.parse(text)
      socket.sent.push({ method, params })
      queueMicrotask(() =>
        socket.onmessage({
          data: JSON.stringify({ id, ...answers(method, params) })
        })
      )
    }
  }
  return socket
}

describe('devtools', () => {
  it('matches replies to commands and unwraps values', async () => {
    const socket = fake_socket((method, params) =>
      method === 'Runtime.evaluate'
        ? { result: { result: { value: params.expression.length } } }
        : { result: { ok: method } }
    )
    const { send, evaluate } = devtools(socket, 'og-candidates')
    expect(await send('Runtime.enable')).toEqual({ ok: 'Runtime.enable' })
    expect(await evaluate('abc')).toBe(3)
    expect(socket.sent[1].params).toMatchObject({
      awaitPromise: true,
      returnByValue: true
    })
  })

  it('rejects command errors and page exceptions', async () => {
    const socket = fake_socket(method =>
      method === 'Runtime.evaluate'
        ? { result: { exceptionDetails: {} } }
        : { error: { message: 'no such method' } }
    )
    const { send, evaluate } = devtools(socket, 'og-candidates')
    await expect(send('Nope')).rejects.toThrow('no such method')
    await expect(evaluate('x')).rejects.toThrow('evaluate failed')
  })

  it('logs page errors and ignores unknown replies', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const socket = fake_socket(() => ({}))
    devtools(socket, 'og-candidates')
    socket.onmessage({
      data: JSON.stringify({
        method: 'Runtime.exceptionThrown',
        params: { exceptionDetails: { text: 'boom' } }
      })
    })
    socket.onmessage({ data: JSON.stringify({ id: 99 }) })
    expect(error).toHaveBeenCalledWith('og-candidates: page error', 'boom')
  })
})

describe('page_socket_url', () => {
  it('waits for a page target', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls++
      if (calls === 1) throw new Error('not up')
      return {
        json: async () => [
          { type: 'service_worker', webSocketDebuggerUrl: 'ws://sw' },
          { type: 'page', webSocketDebuggerUrl: 'ws://page' }
        ]
      }
    })
    expect(await page_socket_url(1, 5000)).toBe('ws://page')
  })

  it('gives up when no page appears', async () => {
    vi.stubGlobal('fetch', async () => ({ json: async () => [] }))
    await expect(page_socket_url(1, 0)).rejects.toThrow(/never exposed/)
  })
})

describe('connect', () => {
  it('resolves on open and rejects on error', async () => {
    vi.stubGlobal(
      'WebSocket',
      class {
        constructor(url) {
          queueMicrotask(() =>
            url === 'ws://ok' ? this.onopen() : this.onerror()
          )
        }
      }
    )
    expect(await connect('ws://ok')).toBeTruthy()
    await expect(connect('ws://bad')).rejects.toThrow(/socket failed/)
  })
})

const png = Buffer.from('png-bytes').toString('base64')

/** A page that finishes after one status poll and offers given candidates. */
const page_with =
  (candidates, { done = true } = {}) =>
  async () => ({
    evaluate: async expression => {
      if (expression.includes('_done')) return done
      if (expression.includes('header p')) return 'rendering 1 of 1'
      if (expression.includes('.map(')) return candidates
      return `data:image/png;base64,${png}`
    }
  })

const browser = () => {
  const launched = []
  const launch = options => {
    launched.push(options)
    return { kill: () => launched.push('killed') }
  }
  return { launched, launch }
}

const run = options =>
  main({
    dist_dir,
    out_dir,
    chrome_path,
    port: 0,
    poll_ms: 0,
    ready_timeout_ms: 1000,
    ...options
  })

describe('main', () => {
  it('writes each candidate and a manifest, then shuts down', async () => {
    mkdirSync(out_dir)
    writeFileSync(path.join(out_dir, 'stale.png'), 'old')
    const { launched, launch } = browser()
    const candidates = [{ itemid: '/+1/posters/2', style: 'a', file: 'a.png' }]
    expect(await run({ launch, page: page_with(candidates) })).toEqual(
      candidates
    )
    expect(readFileSync(path.join(out_dir, 'a.png'), 'utf8')).toBe('png-bytes')
    expect(existsSync(path.join(out_dir, 'stale.png'))).toBe(false)
    const manifest = JSON.parse(
      readFileSync(path.join(out_dir, 'manifest.json'), 'utf8')
    )
    expect(manifest.candidates).toEqual(candidates)
    expect(launched[0].target_url).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/og-candidates$/
    )
    expect(launched.at(-1)).toBe('killed')
    expect(existsSync(launched[0].profile_dir)).toBe(false)
    expect(console.info).toHaveBeenCalledWith('og-candidates: rendering 1 of 1')
  })

  it('fails when the page never finishes', async () => {
    const { launched, launch } = browser()
    await expect(
      run({ launch, page: page_with([], { done: false }), ready_timeout_ms: 0 })
    ).rejects.toThrow(/never finished/)
    expect(launched.at(-1)).toBe('killed')
  })

  it('fails when no poster qualifies', async () => {
    const { launch } = browser()
    await expect(run({ launch, page: page_with([]) })).rejects.toThrow(
      /no eligible landscape posters/
    )
    expect(existsSync(out_dir)).toBe(false)
  })

  it('checks the build before launching', async () => {
    const { launched, launch } = browser()
    await expect(run({ launch, chrome_path: undefined })).rejects.toThrow(
      /CHROME_PATH/
    )
    expect(launched).toEqual([])
    expect(readdirSync(root)).not.toContain('profile')
  })
})
