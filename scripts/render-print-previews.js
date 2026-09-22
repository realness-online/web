/**
 * Render a PNG preview for every print the shop lists, and upload it beside
 * the poster (`people/<author>/posters/<created>.png`) with a Firebase
 * download token, which is what the checkout function hands to Stripe.
 *
 * The shop lists the live `posters/` folder's plain `<created>.html.gz`
 * files - the app's directory listing skips dashed (layer) filenames and
 * dedupes timestamps, so previews beside the posters are invisible to it.
 *
 * Builds dist first (`vp run build`), serves it locally, and drives the
 * poster driver through the devtools protocol - the same page the app's
 * export renderer runs on.
 *
 * Usage:
 *   npm run prints:previews -- [--limit N] [--force] [--no-upload]
 *
 * Env:
 *   CHROME_PATH      Chromium browser (defaults to Brave)
 *   PRINTS_AUTHOR    poster author id, e.g. /+16282281824 (defaults to
 *                    VITE_ADMIN_ID from .env.local)
 *   PRINTS_BUCKET    storage bucket (defaults to realness-online.appspot.com)
 */
import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const project_root = path.join(__dirname, '..')
const dist_dir = path.join(project_root, 'dist')
const out_dir = path.join(project_root, 'artifacts', 'print-previews')

const DRIVER_ROUTE = '/poster-driver'
const SERVER_PORT = 4181
const DEBUG_PORT = 9335
const READY_TIMEOUT_MS = 120000
const POLL_MS = 1000
const BROWSER_TIMEOUT_MS = 20000
const BROWSER_POLL_MS = 200
const PROFILE_RM_RETRIES = 5
const PROFILE_RM_DELAY_MS = 200
const HTTP_OK = 200
const NOT_FOUND = 404

const chrome_path =
  process.env.CHROME_PATH ??
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
const bucket = process.env.PRINTS_BUCKET ?? 'realness-online.appspot.com'

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
  console.error(`print-previews: ${message}`)
  process.exit(1)
}

const [, , ...args] = process.argv
const flag = name => args.includes(name)
const option = name => {
  const index = args.indexOf(name)
  return index === -1 ? null : args[index + 1]
}
const limit = Number(option('--limit') ?? 0)
const force = flag('--force')
const upload = !flag('--no-upload')

if (!fs.existsSync(path.join(dist_dir, 'index.html')))
  fail('dist/index.html missing - npm run prints:previews builds first')
if (!fs.existsSync(chrome_path)) fail(`CHROME_PATH not found: ${chrome_path}`)

/** The author whose posters are for sale: `PRINTS_AUTHOR`, else `.env.local`. */
const author = (() => {
  const raw =
    process.env.PRINTS_AUTHOR ||
    (() => {
      for (const name of ['.env.local', '.env']) {
        const file = path.join(project_root, name)
        if (!fs.existsSync(file)) continue
        const match = fs
          .readFileSync(file, 'utf8')
          .match(/^\s*VITE_ADMIN_ID\s*=\s*(.+?)\s*$/m)
        if (match) return match[1].replace(/^['"]|['"]$/g, '')
      }
      return null
    })()
  if (!raw) fail('no author: set PRINTS_AUTHOR or VITE_ADMIN_ID in .env.local')
  return `/${raw.replace(/^\/+/, '')}`
})()

const gcloud = gcloud_args => {
  try {
    return execFileSync('gcloud', gcloud_args, { encoding: 'utf8' })
  } catch (error) {
    fail(
      `gcloud failed (${gcloud_args.join(' ')}): ${error.stderr?.trim() || error.message}`
    )
  }
}

/** An object listing, empty when the prefix holds nothing. */
const gcloud_lines = gcloud_args => {
  try {
    return execFileSync('gcloud', gcloud_args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

const storage_prefix = `gs://${bucket}/people${author}/posters/`

/** The shop's prints: live-folder plain `<created>.html.gz`, one per stamp. */
const list_prints = () =>
  gcloud_lines(['storage', 'ls', storage_prefix])
    .map(url => path.posix.basename(url))
    .filter(name => /^\d+\.html\.gz$/.test(name))
    .map(name => Number(name.replace('.html.gz', '')))
    .sort((a, b) => b - a)

/** Previews already on storage, by created stamp. */
const list_previews = () =>
  new Set(
    gcloud_lines(['storage', 'ls', storage_prefix])
      .map(url => path.posix.basename(url))
      .filter(name => /^\d+\.png$/.test(name))
      .map(name => Number(name.replace('.png', '')))
  )

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
        'print-previews: page error',
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
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          'evaluate failed'
      )
    return result.result?.value
  }
  return { send, evaluate }
}

const write_preview = (created, data_url) => {
  fs.mkdirSync(out_dir, { recursive: true })
  const file = path.join(out_dir, `${created}.png`)
  fs.writeFileSync(file, Buffer.from(data_url.split(',')[1], 'base64'))
  return file
}

const upload_preview = (created, file) => {
  const destination = `${storage_prefix}${created}.png`
  gcloud([
    'storage',
    'cp',
    file,
    destination,
    '--content-type=image/png',
    `--custom-metadata=firebaseStorageDownloadTokens=${randomUUID()}`
  ])
}

const run = async () => {
  const prints = list_prints()
  if (!prints.length) fail(`no prints found under ${storage_prefix}`)
  const existing = upload ? list_previews() : new Set()
  const wanted = prints.filter(created => force || !existing.has(created))
  const batch = limit > 0 ? wanted.slice(0, limit) : wanted

  console.info(
    `print-previews: ${prints.length} prints, ${existing.size} previews, ` +
      `${batch.length} to render (author ${author})`
  )
  if (!batch.length) {
    console.info('print-previews: nothing to do; --force re-renders')
    return
  }

  const server = await serve_dist()
  const profile_dir = mkdtempSync(path.join(tmpdir(), 'print-previews-'))
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
      console.warn(`print-previews: left profile dir behind at ${profile_dir}`)
    }
  }

  const failures = []
  try {
    const socket = await connect(await page_socket_url())
    const { evaluate } = devtools(socket)

    const ready = await (async () => {
      const deadline = Date.now() + READY_TIMEOUT_MS
      while (Date.now() < deadline) {
        if (await evaluate('window.poster_driver?.ready === true')) return true
        await sleep(POLL_MS)
      }
      return false
    })()
    if (!ready) throw new Error('poster driver never became ready')

    for (const created of batch) {
      const itemid = `${author}/posters/${created}`
      try {
        const result = await evaluate(
          `window.poster_driver.render_stored(${JSON.stringify(itemid)})`
        )
        if (!result?.png) throw new Error('render returned no png')
        const file = write_preview(created, result.png)
        if (upload) upload_preview(created, file)
        console.info(
          `print-previews: ${created} ${result.width}x${result.height}` +
            `${upload ? ' uploaded' : ' (no upload)'}`
        )
      } catch (error) {
        failures.push(created)
        console.error(`print-previews: ${created} failed - ${error.message}`)
      }
    }
  } finally {
    shutdown()
  }

  if (failures.length) fail(`${failures.length} failed: ${failures.join(', ')}`)
  console.info(
    `print-previews: done, ${batch.length - failures.length} rendered`
  )
}

run().catch(error => {
  console.error(`print-previews: ${error.message}`)
  process.exit(1)
})
