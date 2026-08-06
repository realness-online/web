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
const out_dir = path.join(project_root, 'artifacts', 'poster-driver')

const DRIVER_ROUTE = '/poster-driver'
const READY_TIMEOUT_MS = 120000
const POLL_MS = 1000
const BROWSER_TIMEOUT_MS = 20000
const BROWSER_POLL_MS = 200
const SERVER_PORT = 4180
const DEBUG_PORT = 9334
const HTTP_OK = 200
const NOT_FOUND = 404
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
  console.error(`render-poster: ${message}`)
  process.exit(1)
}

const [, , input_path] = process.argv
if (!input_path) fail('usage: npm run poster <image-path>')
if (!fs.existsSync(`${dist_dir}/index.html`))
  fail('dist/index.html missing - npm run build first')
if (!chrome_path)
  fail(
    'CHROME_PATH is not set - point it at a Chromium browser, the same one npm run score uses'
  )
if (!fs.existsSync(chrome_path)) fail(`CHROME_PATH not found: ${chrome_path}`)
if (!fs.existsSync(input_path)) fail(`image not found: ${input_path}`)

const image_data_url = `data:image/${path.extname(input_path).slice(1)};base64,${fs
  .readFileSync(input_path)
  .toString('base64')}`

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
        'render-poster: page error',
        message.params?.exceptionDetails?.exception?.description ??
          message.params?.exceptionDetails?.text
      )
    if (message.method === 'Runtime.consoleAPICalled')
      console.error(
        'render-poster: console',
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

const run = async () => {
  const server = await serve_dist()
  const profile_dir = mkdtempSync(path.join(tmpdir(), 'render-poster-'))
  const target_url = `http://127.0.0.1:${SERVER_PORT}${DRIVER_ROUTE}`
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
      rmSync(profile_dir, {
        recursive: true,
        force: true,
        maxRetries: PROFILE_RM_RETRIES,
        retryDelay: PROFILE_RM_DELAY_MS
      })
    } catch {
      console.warn(`render-poster: left profile dir behind at ${profile_dir}`)
    }
  }
  try {
    const socket = await connect(await page_socket_url())
    const { send, evaluate } = devtools(socket)
    await send('Runtime.enable')
    await send('Log.enable').catch(() => {})

    console.info(`render-poster: loading ${target_url}`)
    const ready = await (async () => {
      const deadline = Date.now() + READY_TIMEOUT_MS
      while (Date.now() < deadline) {
        if (await evaluate('window.__poster_driver?.ready === true'))
          return true
        await sleep(POLL_MS)
      }
      return false
    })()
    if (!ready) throw new Error('poster driver never became ready')

    const image_json = JSON.stringify(image_data_url)
    let result
    try {
      result = await evaluate(
        `window.__poster_driver.render(${image_json}).then(r => r)`
      )
    } catch (error) {
      const debug = await evaluate(
        'window.__poster_driver?.debug?.() ?? null'
      ).catch(() => null)
      console.error(
        'render-poster: render failed',
        error.message,
        '| debug:',
        JSON.stringify(debug)
      )
      throw error
    }
    if (!result?.itemid || !result.svg)
      throw new Error('poster render returned nothing useful')
    fs.mkdirSync(out_dir, { recursive: true })
    const stem = result.itemid.replace(/\./g, '-').replace(/\//g, '_')
    const svg_file = path.join(out_dir, `${stem}.svg`)
    fs.writeFileSync(svg_file, result.svg)
    console.info(`render-poster: wrote ${svg_file}`)
    if (result.png) {
      const png_file = path.join(out_dir, `${stem}.png`)
      fs.writeFileSync(
        png_file,
        Buffer.from(result.png.split(',')[1], 'base64')
      )
      console.info(
        `render-poster: wrote ${png_file}`,
        `(viewBox ${result.viewbox} ${result.width}x${result.height})`
      )
    }
  } finally {
    shutdown()
  }
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(`render-poster: ${error.message}`)
    process.exit(1)
  })
