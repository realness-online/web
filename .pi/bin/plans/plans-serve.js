#!/usr/bin/env node
import { execFile as exec_file } from 'node:child_process'
import { realpathSync as realpath_sync, watch } from 'node:fs'
import { createServer as create_server } from 'node:http'
import { readFile as read_file, stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain'
}

const is_file = async path => (await stat(path).catch(() => null))?.isFile() ?? false

/** The file a URL path names: exact, then x.html (x/ too), then x/index.html. Never outside root. */
export const resolve_file = async (root, url_path) => {
  const path = normalize(decodeURIComponent(url_path.split('?')[0]))
  const base = join(root, path)
  if (base !== root && !base.startsWith(root + sep)) return null
  const page = `${base.replace(/[\\/]$/, '')}.html`
  for (const candidate of [base, page, join(base, 'index.html')]) {
    if (await is_file(candidate)) return candidate
  }
  return null
}

/** Local pages must be fresh: this worker drops every cache and unregisters itself. */
export const RETIRE_WORKER = `self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) await caches.delete(key)
  await self.registration.unregister()
  for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url)
})()))
`

/** Every open page listens here: it reloads after a build and shows a failed build's line. */
export const RELOAD_SCRIPT = `<script>{
const events = new EventSource('/events')
events.onmessage = () => location.reload()
events.addEventListener('failed', ({ data }) => {
  let shown = document.querySelector('output[role=alert]')
  if (!shown) {
    shown = document.createElement('output')
    shown.setAttribute('role', 'alert')
    document.body.prepend(shown)
  }
  shown.style.cssText = 'display:block;position:sticky;top:0;z-index:9;padding:.5rem 1rem;background:#933237;color:#ecebe4;font:inherit'
  shown.textContent = 'Build failed - showing the last good build. ' + data
})
}</script>`

/** Open `/events` streams; `send` tells each page a build finished, `fail` that one failed. A page that opens after a failure hears it. */
export const reload_events = () => {
  const streams = new Set()
  let failure = null
  const failed = line => `event: failed\ndata: ${line.replace(/\n/g, ' ')}\n\n`
  return {
    add: response => {
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' })
      response.write(failure ? failed(failure) : ': open\n\n')
      streams.add(response)
      response.on('close', () => streams.delete(response))
    },
    send: () => {
      failure = null
      for (const stream of streams) stream.write('data: reload\n\n')
    },
    fail: line => {
      failure = line
      for (const stream of streams) stream.write(failed(line))
    }
  }
}

/** Blog pages are /articles/ and the article slugs; their partials come from the blog. */
const from_blog = async (blog, path) => {
  if (path === '/articles' || path.startsWith('/articles/')) return true
  const slug = path.match(/^\/blog\/([^/]+)/)?.[1]
  return !!slug && (await is_file(join(blog, 'blog', `${slug}.html`)))
}

/**
 * Plans and blog drafts on one server. Plans own `/`; the blog index is `/articles/`.
 * A file either lacks falls back to the other.
 * @param {string} plans plans dist
 * @param {string} [blog] blog dist
 * @param {ReturnType<typeof reload_events>} [events]
 */
export const serve = (plans, blog, events = reload_events()) =>
  create_server(async (request, response) => {
    const url = request.url ?? '/'
    const path = url.split('?')[0]
    if (path === '/events') return events.add(response)
    if (path === '/service.worker.js') {
      response.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-store' })
      return response.end(RETIRE_WORKER)
    }
    const page = new URL(request.headers.referer ?? url, 'http://local').pathname
    const blog_first = blog && (await from_blog(blog, path.startsWith('/partials/') ? page : path))
    const roots = blog ? (blog_first ? [blog, plans] : [plans, blog]) : [plans]
    const wanted = path === '/articles' || path.startsWith('/articles/') ? '/' : url
    let file = null
    for (const root of roots) {
      file = await resolve_file(root, root === blog ? wanted : url)
      if (file) break
    }
    if (!file) {
      response.writeHead(404, { 'content-type': TYPES['.html'] })
      return response.end('<!doctype html><title>Not found</title><h1>Not found</h1>')
    }
    response.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store'
    })
    const body = await read_file(file)
    response.end(extname(file) === '.html' ? `${body}${RELOAD_SCRIPT}` : body)
  })

/** The one line of a failed build worth showing. */
export const failure_line = error =>
  (
    (error.stderr || error.message).split('\n').find(line => /^\w*Error\b/.test(line.trim())) ??
    error.message.split('\n')[0]
  ).trim()

/**
 * Builds after a folder changes: waits until edits pause, runs one build at a
 * time, and follows a build with one more when files changed during it.
 * @param {{ folder: string, build: (changed: string[]) => Promise<unknown>, wait?: number, ignore?: (file: string) => boolean, log?: (line: string) => void }} options
 */
export const watch_builds = ({ folder, build, wait = 500, ignore = () => false, log = console.log }) => {
  let timer = null
  let running = null
  let again = false
  const changed = new Set()
  const start = async () => {
    if (running) {
      again = true
      return
    }
    const files = [...changed]
    changed.clear()
    const began = Date.now()
    running = build(files).then(
      () => log(`built in ${Date.now() - began}ms: ${files.join(', ') || 'all'}`),
      error => log(`build failed: ${failure_line(error)}`)
    )
    await running
    running = null
    if (again) {
      again = false
      await start()
    }
  }
  const watcher = watch(folder, { recursive: true }, (_, file) => {
    if (!file || ignore(file)) return
    changed.add(file)
    clearTimeout(timer)
    timer = setTimeout(start, wait)
  })
  return {
    start,
    close: () => {
      clearTimeout(timer)
      watcher.close()
    }
  }
}

/** Hidden files, session transcripts, and the commands page the build writes never start a build. */
export const ignored = file =>
  file.split(sep).some(part => part.startsWith('.')) ||
  file.startsWith(`Sessions${sep}`) ||
  /[\\/]Runs[\\/].+[\\/]sessions[\\/]/.test(file) ||
  /pages[\\/]commands\.(html|js)$/.test(file)

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const root = resolve(dirname(file_url_to_path(import.meta.url)), '../../..')
  const apps = join(root, 'artifacts/apps')
  const port = Number(process.env.PORT ?? 4323)
  const run = promisify(exec_file)
  const events = reload_events()
  const builds = watch_builds({
    folder: realpath_sync(join(root, 'vault')),
    ignore: ignored,
    build: changed =>
      run(process.execPath, [join(root, '.pi/bin/plans/plans.js'), ...changed.map(file => `--changed=${file}`)], {
        cwd: root,
        timeout: 120_000,
        maxBuffer: 1024 * 1024
      }).then(events.send, error => {
        events.fail(failure_line(error))
        throw error
      })
  })
  builds.start()
  serve(join(apps, 'plans/dist'), join(apps, 'blog/dist'), events).listen(port, '127.0.0.1', () =>
    console.log(`vault -> http://127.0.0.1:${port}/  articles -> http://127.0.0.1:${port}/articles/`)
  )
}
