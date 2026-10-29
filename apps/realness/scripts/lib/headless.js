import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { artifacts_dir } from './artifacts.js'

const BROWSER_TIMEOUT_MS = 20000
const BROWSER_POLL_MS = 200
const PROFILE_RM_RETRIES = 5
const PROFILE_RM_DELAY_MS = 200
const HTTP_OK = 200
const NOT_FOUND = 404

const content_types = {
  '.css': 'text/css',
  '.gz': 'application/gzip',
  '.html': 'text/html',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml'
}

/** @param {number} ms */
export const sleep = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })

/**
 * Static server over dist: exact file, then x.html, then the SPA fallback.
 * @param {string} dist_dir
 * @param {number} port
 * @returns {Promise<http.Server>}
 */
export const serve_dist = (dist_dir, port) =>
  new Promise(resolve => {
    const server = http.createServer((request, response) => {
      const url_path = decodeURIComponent(
        (request.url ?? '/').split('?')[0]
      ).replace(/^\/+/, '')
      let file = path.join(dist_dir, url_path)
      if (file !== dist_dir && !file.startsWith(dist_dir + path.sep)) {
        response.writeHead(NOT_FOUND)
        response.end()
        return
      }
      if (!fs.existsSync(file) && fs.existsSync(`${file}.html`))
        file = `${file}.html`
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
        file = path.join(dist_dir, 'index.html')
      response.writeHead(HTTP_OK, {
        'content-type':
          content_types[path.extname(file)] ?? 'application/octet-stream'
      })
      fs.createReadStream(file).pipe(response)
    })
    server.listen(port, '127.0.0.1', () => resolve(server))
  })

/**
 * The page target's own debugger socket, so no Target domain is needed.
 * @param {number} debug_port
 * @param {number} [timeout]
 */
export const page_socket_url = async (
  debug_port,
  timeout = BROWSER_TIMEOUT_MS
) => {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debug_port}/json/list`)
      const targets = await response.json()
      const page = targets.find(
        target => target.type === 'page' && target.webSocketDebuggerUrl
      )
      if (page) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(BROWSER_POLL_MS)
  }
  throw new Error('browser never exposed a page target')
}

/** @param {string} socket_url */
export const connect = socket_url =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(socket_url)
    socket.onopen = () => resolve(socket)
    socket.onerror = () => reject(new Error('devtools socket failed'))
  })

/**
 * Minimal devtools client: send a command, resolve on the matching id, and
 * report page errors (and, when asked, page console output) under a label.
 * @param {{ send: (text: string) => void, onmessage?: Function }} socket
 * @param {string} label
 * @param {{ page_console?: boolean }} [options]
 */
export const devtools = (socket, label, { page_console = false } = {}) => {
  let next_id = 0
  const pending = new Map()
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data))
    if (message.id !== undefined && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
      return
    }
    if (message.method === 'Runtime.exceptionThrown')
      console.error(
        `${label}: page error`,
        message.params?.exceptionDetails?.exception?.description ??
          message.params?.exceptionDetails?.text
      )
    if (page_console && message.method === 'Runtime.consoleAPICalled')
      console.error(
        `${label}: console`,
        message.params?.args?.map(arg => arg.value ?? arg.description).join(' ')
      )
  }
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++next_id
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    })
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          'evaluate failed'
      )
    return result.result?.value
  }
  return { send, evaluate }
}

/**
 * Start a headless browser on a page with remote debugging.
 * @param {{ chrome_path: string, target_url: string, profile_dir: string, debug_port: number }} options
 */
export const launch_browser = ({
  chrome_path,
  target_url,
  profile_dir,
  debug_port
}) =>
  spawn(
    chrome_path,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${debug_port}`,
      `--user-data-dir=${profile_dir}`,
      target_url
    ],
    { stdio: 'ignore' }
  )

/**
 * Connect to the launched browser's page and enable its runtime events.
 * @param {number} debug_port
 * @param {string} label
 * @param {{ page_console?: boolean }} [options]
 */
export const open_page = async (debug_port, label, options) => {
  const tools = devtools(
    await connect(await page_socket_url(debug_port)),
    label,
    options
  )
  await tools.send('Runtime.enable')
  return tools
}

/**
 * A fresh browser profile folder under artifacts.
 * @param {string} prefix
 */
export const make_profile = prefix => {
  fs.mkdirSync(artifacts_dir, { recursive: true })
  return fs.mkdtempSync(path.join(artifacts_dir, `${prefix}-`))
}

/**
 * Remove a browser profile, warning instead of failing when it stays locked.
 * @param {string} profile_dir
 * @param {string} label
 */
export const remove_profile = (profile_dir, label) => {
  try {
    fs.rmSync(profile_dir, {
      recursive: true,
      force: true,
      maxRetries: PROFILE_RM_RETRIES,
      retryDelay: PROFILE_RM_DELAY_MS
    })
  } catch {
    console.warn(`${label}: left profile dir behind at ${profile_dir}`)
  }
}

/**
 * Poll until the page's poster driver says it is ready.
 * @param {(expression: string) => Promise<unknown>} evaluate
 * @param {{ timeout_ms: number, poll_ms: number }} options
 */
export const wait_for_driver = async (evaluate, { timeout_ms, poll_ms }) => {
  const deadline = Date.now() + timeout_ms
  while (Date.now() < deadline) {
    if (await evaluate('window.poster_driver?.ready === true')) return
    await sleep(poll_ms)
  }
  throw new Error('poster driver never became ready')
}
