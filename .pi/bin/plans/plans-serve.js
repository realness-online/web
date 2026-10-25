#!/usr/bin/env node
import { createServer as create_server } from 'node:http'
import { readFile as read_file, stat } from 'node:fs/promises'
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

/** The file a URL path names: exact, then x.html, then x/index.html. Never outside root. */
export const resolve_file = async (root, url_path) => {
  const path = normalize(decodeURIComponent(url_path.split('?')[0]))
  const base = join(root, path)
  if (base !== root && !base.startsWith(root + sep)) return null
  for (const candidate of [base, `${base}.html`, join(base, 'index.html')]) {
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

/** Blog pages are /articles/ and the article slugs; their partials come from the blog. */
const from_blog = async (blog, path) => {
  if (path === '/articles' || path.startsWith('/articles/')) return true
  const slug = path.match(/^\/blog\/([^/]+)/)?.[1]
  return !!slug && (await is_file(join(blog, 'blog', slug, 'index.html')))
}

/**
 * Plans and blog drafts on one server. Plans own `/`; the blog index is `/articles/`.
 * A file either lacks falls back to the other.
 * @param {string} plans plans dist
 * @param {string} [blog] blog dist
 */
export const serve = (plans, blog) =>
  create_server(async (request, response) => {
    const url = request.url ?? '/'
    const path = url.split('?')[0]
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
    response.end(await read_file(file))
  })

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const apps = resolve(dirname(file_url_to_path(import.meta.url)), '../../../artifacts/apps')
  const port = Number(process.env.PORT ?? 4323)
  serve(join(apps, 'plans/dist'), join(apps, 'blog/dist')).listen(port, '127.0.0.1', () =>
    console.log(`vault -> http://127.0.0.1:${port}/  articles -> http://127.0.0.1:${port}/articles/`)
  )
}
