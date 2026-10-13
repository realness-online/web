#!/usr/bin/env node
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
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
  '.txt': 'text/plain',
}

const is_file = async (path) => (await stat(path).catch(() => null))?.isFile() ?? false

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

export const serve = (root) =>
  createServer(async (request, response) => {
    const file = await resolve_file(root, request.url ?? '/')
    if (!file) {
      response.writeHead(404, { 'content-type': TYPES['.html'] })
      return response.end('<!doctype html><title>Not found</title><h1>Not found</h1>')
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    response.end(await readFile(file))
  })

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const root = resolve(dirname(file_url_to_path(import.meta.url)), '../artifacts/apps/plans/dist')
  const port = Number(process.env.PORT ?? 4323)
  serve(root).listen(port, '127.0.0.1', () => console.log(`plans -> http://127.0.0.1:${port}/`))
}
