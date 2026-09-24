// The dev write API: one microdata document per file under `data/`. A Vite
// middleware, so `npm run dev` needs no second process. g5 puts the same
// endpoints on the host, after auth.
//
// The store never sees this file. It talks to a `Backend` (see backend.js),
// which in dev is a thin fetch over these routes.
import { gzipSync } from 'node:zlib'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'data')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
}

const content_type = path => TYPES[path.slice(path.lastIndexOf('.'))] ?? 'application/octet-stream'

/**
 * A request path resolved inside the store root, or null if it climbs out.
 * @param {string} root
 * @param {string} path
 * @returns {string | null}
 */
const under_root = (root, path) => {
  const target = resolve(root, '.' + path.replace(/^\/+/, '/'))
  if (target !== root && !target.startsWith(root + sep)) return null
  return target
}

const read_body = request =>
  new Promise((done, fail) => {
    const chunks = []
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => done(Buffer.concat(chunks)))
    request.on('error', fail)
  })

const json = (response, status, body) => {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

/**
 * The plugin. `root` defaults to `data/` beside this file; tests pass a temp
 * directory.
 * @param {{ root?: string }} [config]
 */
export const file_api = ({ root = DEFAULT_ROOT } = {}) => ({
  name: 'brayness-file-api',

  configureServer(server) {
    server.middlewares.use('/api', async (request, response) => {
      const url = new URL(request.url, 'http://localhost')
      const clean = decodeURIComponent(url.pathname).replace(/^\/+/, '')
      const slash = clean.indexOf('/')
      const resource = slash === -1 ? clean : clean.slice(0, slash)
      const path = slash === -1 ? '' : clean.slice(slash + 1)
      const target = path && under_root(root, '/' + path)

      try {
        if (resource === 'move' && request.method === 'POST') {
          const { from, to } = JSON.parse((await read_body(request)).toString() || '{}')
          const source = from && under_root(root, '/' + from)
          const destination = to && under_root(root, '/' + to)
          if (!source || !destination) return json(response, 400, { error: 'unsafe path' })
          await mkdir(dirname(destination), { recursive: true })
          await rename(source, destination)
          return json(response, 200, { moved: true })
        }

        if (!target || !path) return json(response, 400, { error: 'unsafe path' })

        if (resource === 'dir' && request.method === 'GET') {
          const entries = await readdir(target, { withFileTypes: true })
          return json(response, 200, {
            items: entries.filter(entry => entry.isFile()).map(entry => ({ name: entry.name })),
            prefixes: entries.filter(entry => entry.isDirectory()).map(entry => ({ name: entry.name }))
          })
        }

        if (resource !== 'file') return json(response, 404, { error: 'unknown route' })

        if (request.method === 'PUT') {
          await mkdir(dirname(target), { recursive: true })
          await writeFile(target, await read_body(request))
          return json(response, 200, { uploaded: true })
        }

        if (request.method === 'GET') {
          const body = await readFile(target)
          const type = content_type(target)
          response.setHeader('content-type', type)
          response.setHeader('vary', 'accept-encoding')
          if (type.startsWith('text/') && /\bgzip\b/.test(request.headers['accept-encoding'] ?? '')) {
            response.setHeader('content-encoding', 'gzip')
            return response.end(gzipSync(body))
          }
          return response.end(body)
        }

        if (request.method === 'DELETE') {
          await rm(target, { force: true })
          return json(response, 200, { removed: true })
        }

        return json(response, 405, { error: 'method not allowed' })
      } catch (error) {
        const missing = error && typeof error === 'object' && error.code === 'ENOENT'
        return json(response, missing ? 404 : 500, { error: String(error?.message ?? error) })
      }
    })
  }
})