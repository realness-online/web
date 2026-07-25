import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const project_root = path.join(__dirname, '..')
const dist_dir = path.join(project_root, 'dist')
const out_dir = path.join(project_root, 'artifacts', 'og-candidates')

const OG_ROUTE = '/og-candidates'
const READY_TIMEOUT_MS = 300000
const POLL_MS = 1000
const BROWSER_TIMEOUT_MS = 20000
const BROWSER_POLL_MS = 200
const SERVER_PORT = 4179
const DEBUG_PORT = 9333
const HTTP_OK = 200
const NOT_FOUND = 404
const MS_PER_SECOND = 1000
const PROFILE_RM_RETRIES = 5
const PROFILE_RM_DELAY_MS = 200

const chrome_path = process.env.CHROME_PATH

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

const fail = message => {
  console.error(`og-candidates: ${message}`)
  process.exit(1)
}

if (!fs.existsSync(path.join(dist_dir, 'index.html')))
  fail('dist/index.html missing - run npm run build first')

if (!chrome_path)
  fail(
    'CHROME_PATH is not set - point it at a Chromium browser, the same one npm run score uses'
  )

if (!fs.existsSync(chrome_path)) fail(`CHROME_PATH not found: ${chrome_path}`)

/** Static server over dist with an SPA fallback, so the route resolves. */
const serve_dist = () =>
  new Promise(resolve => {
    const server = http.createServer((request, response) => {
      const url_path = decodeURIComponent(
        (request.url ?? '/').split('?')[0]
      ).replace(/^\/+/, '')
      let file = path.join(dist_dir, url_path)
      if (!file.startsWith(dist_dir)) {
        response.writeHead(NOT_FOUND)
        response.end()
        return
      }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
        file = path.join(dist_dir, 'index.html')

      response.writeHead(HTTP_OK, {
        'content-type':
          content_types[path.extname(file)] ?? 'application/octet-stream'
      })
      fs.createReadStream(file).pipe(response)
    })
    server.listen(SERVER_PORT, '127.0.0.1', () => resolve(server))
  })

const sleep = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })

/**
 * The page target exposes its own debugger socket, which avoids the Target
 * domain entirely - connect straight to the tab.
 */
const page_socket_url = async () => {
  const deadline = Date.now() + BROWSER_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)
      const targets = await response.json()
      const page = targets.find(
        target => target.type === 'page' && target.webSocketDebuggerUrl
      )
      if (page) return page.webSocketDebuggerUrl
    } catch {
      // browser is still coming up
    }
    await sleep(BROWSER_POLL_MS)
  }
  throw new Error('browser never exposed a page target')
}

const connect = socket_url =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(socket_url)
    socket.onopen = () => resolve(socket)
    socket.onerror = () => reject(new Error('devtools socket failed'))
  })

/** Minimal CDP client: send a command, resolve on the matching id. */
const devtools = socket => {
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
        'og-candidates: page error',
        message.params?.exceptionDetails?.text
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
      throw new Error(result.exceptionDetails.text ?? 'evaluate failed')
    return result.result?.value
  }

  return { send, evaluate }
}

const write_candidate = (candidate, data_url) => {
  const base64 = data_url.slice(data_url.indexOf(',') + 1)
  fs.writeFileSync(
    path.join(out_dir, candidate.file),
    Buffer.from(base64, 'base64')
  )
}

const run = async () => {
  const server = await serve_dist()
  const profile_dir = mkdtempSync(path.join(tmpdir(), 'og-candidates-'))
  const target_url = `http://127.0.0.1:${SERVER_PORT}${OG_ROUTE}`

  const browser = spawn(
    chrome_path,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profile_dir}`,
      target_url
    ],
    { stdio: 'ignore' }
  )

  const shutdown = () => {
    browser.kill()
    server.close()
    try {
      // The browser writes to its profile as it dies, so removal can lose a
      // race with it. The candidates are already on disk either way.
      rmSync(profile_dir, {
        recursive: true,
        force: true,
        maxRetries: PROFILE_RM_RETRIES,
        retryDelay: PROFILE_RM_DELAY_MS
      })
    } catch {
      console.warn(`og-candidates: left profile dir behind at ${profile_dir}`)
    }
  }

  try {
    const socket = await connect(await page_socket_url())
    const { send, evaluate } = devtools(socket)
    await send('Runtime.enable')

    console.info(`og-candidates: rendering ${target_url}`)
    const deadline = Date.now() + READY_TIMEOUT_MS
    let done = false
    while (!done && Date.now() < deadline) {
      await sleep(POLL_MS)
      done = await evaluate('window.__og_candidates_done === true')
      const status = await evaluate(
        'document.querySelector("#og-candidates header p")?.textContent ?? ""'
      )
      if (status) console.info(`og-candidates: ${status}`)
    }
    if (!done) throw new Error('page never finished rendering candidates')

    const candidates = await evaluate(
      'window.__og_candidates.map(({ itemid, style, file }) => ({ itemid, style, file }))'
    )
    if (!candidates?.length)
      throw new Error('no eligible landscape posters - nothing written')

    fs.rmSync(out_dir, { recursive: true, force: true })
    fs.mkdirSync(out_dir, { recursive: true })

    for (const [index, candidate] of candidates.entries()) {
      const data_url = await evaluate(
        `window.__og_candidates[${index}].data_url`
      )
      write_candidate(candidate, data_url)
    }

    fs.writeFileSync(
      path.join(out_dir, 'manifest.json'),
      `${JSON.stringify({ generated_at: new Date().toISOString(), candidates }, null, 2)}\n`
    )

    console.info(
      `og-candidates: wrote ${candidates.length} files to artifacts/og-candidates`
    )
    console.info('og-candidates: pick one with npm run og:pick <file>')
  } finally {
    shutdown()
  }
}

const started = Date.now()
run()
  .then(() => {
    console.info(
      `og-candidates: done in ${Math.round((Date.now() - started) / MS_PER_SECOND)}s`
    )
    process.exit(0)
  })
  .catch(error => {
    console.error(`og-candidates: ${error.message}`)
    process.exit(1)
  })
