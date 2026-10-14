import {
  readFileSync as read_file_sync,
  realpathSync as realpath_sync,
  statSync as stat_sync
} from 'node:fs'
import {
  createServer as create_server,
  request as http_request
} from 'node:http'
import { connect } from 'node:net'
import { extname, join, sep } from 'node:path'
import { BadRequest, HOST_FAILURES, NotFound } from './errors.js'
import { verify_host_pass } from '#root/src/sign-on/node/host-pass.js'
import { limit_path } from '#root/src/files/paths.js'
import { can } from '#root/src/can/can.js'
import {
  app_auth,
  ENTER,
  withoutAppCookie as without_app_cookie
} from './app-auth.js'
import { logger } from './log.js'
import { chat_handlers } from './chat.js'
import { startup_handlers } from './startup.js'
import * as vsock from './vsock.js'
import { HTTP } from '#root/lib/http.js'

const BASE64_BLOCK = 4
const MAX_PATHS = 100

const LOG = logger('server')
const EXEC_TIMEOUT_MAX = 1800

export const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm'
}

const send = (response, status, headers, body) => {
  response.writeHead(status, { ...headers, 'content-length': body.length })
  response.end(body)
}

const json = (response, status, payload) => {
  if (status === HTTP.NO_CONTENT)
    return send(response, HTTP.NO_CONTENT, {}, Buffer.alloc(0))
  send(
    response,
    status,
    { 'content-type': 'application/json' },
    Buffer.from(`${JSON.stringify(payload, null, 2)}\n`)
  )
}

const plain = (response, status, message) =>
  send(
    response,
    status,
    { 'content-type': 'text/plain; charset=utf-8' },
    Buffer.from(`${message}\n`)
  )

const readBody = request =>
  new Promise((done, fail) => {
    const chunks = []
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => done(Buffer.concat(chunks)))
    request.on('error', fail)
  })

/** The body as a JSON object; an empty body is {}. */
const readJson = async request => {
  const raw = await readBody(request)
  if (!raw.length) return {}
  let payload
  try {
    payload = JSON.parse(raw)
  } catch (error) {
    throw new BadRequest(`body is not JSON: ${error.message}`)
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload))
    throw new BadRequest('body must be a JSON object')
  return payload
}

/** A file from a published tree. A directory serves index.html; a bare name its .html. */
const site = (store, response, id, rel) => {
  const root = store.publishedSite(id)
  if (!root)
    return plain(response, HTTP.NOT_FOUND, `nothing published for ${id}`)
  const realRoot = realpath_sync(root)
  const inside = path => path === realRoot || path.startsWith(realRoot + sep)
  const is = (path, kind) => {
    try {
      return stat_sync(path)[kind]()
    } catch {
      return false
    }
  }
  let target
  try {
    target = join(realRoot, decodeURIComponent(rel))
  } catch {
    return plain(response, HTTP.BAD_REQUEST, 'bad path encoding')
  }
  if (!inside(target))
    return plain(
      response,
      HTTP.FORBIDDEN,
      'that path leaves the published site'
    )
  if (is(target, 'isDirectory')) target = join(target, 'index.html')
  else if (!is(target, 'isFile') && is(`${target}.html`, 'isFile'))
    target = `${target}.html`
  if (!is(target, 'isFile'))
    return plain(response, HTTP.NOT_FOUND, `no ${rel} in ${id}`)
  if (!inside(realpath_sync(target)))
    return plain(
      response,
      HTTP.FORBIDDEN,
      'that path leaves the published site'
    )
  send(
    response,
    HTTP.OK,
    {
      'content-type':
        CONTENT_TYPES[extname(target).toLowerCase()] ??
        'application/octet-stream',
      'cache-control': 'no-store'
    },
    read_file_sync(target)
  )
}

const health = store => {
  const seed = store.seedStatus()
  const counts = {}
  for (const record of store.list())
    counts[record.state] = (counts[record.state] ?? 0) + 1
  return {
    ok: true,
    seed: {
      built: seed.built,
      matches: seed.matches,
      mismatches: seed.mismatches,
      machine_id: seed.record?.machine_id ?? null,
      boot_id: seed.record?.boot_id ?? null,
      created: seed.record?.created ?? null
    },
    actors: counts
  }
}

const exec = async (store, request, id) => {
  const payload = await readJson(request)
  const stdinB64 = payload.stdin_b64 || ''
  if (typeof stdinB64 !== 'string')
    throw new BadRequest('stdin_b64 must be a base64 string')
  if (
    !/^[A-Za-z0-9+/]*={0,2}$/.test(stdinB64) ||
    stdinB64.length % BASE64_BLOCK
  )
    throw new BadRequest('stdin_b64 is not base64')
  const timeout = payload.timeout ?? null
  if (
    timeout !== null &&
    (typeof timeout !== 'number' ||
      !(timeout > 0 && timeout <= EXEC_TIMEOUT_MAX))
  )
    throw new BadRequest(
      `timeout must be seconds, 0 < t <= ${EXEC_TIMEOUT_MAX}`
    )

  return store.exec(id, payload.argv, {
    cwd: payload.cwd ?? null,
    stdin: Buffer.from(stdinB64, 'base64'),
    timeout
  })
}

const APP_HOST = /^(app-[0-9a-f]{12})\.localhost$/
const appOfHost = header =>
  APP_HOST.exec((header ?? '').split(':')[0])?.[1] ?? null

/**
 * The app's record if this request may reach it now; otherwise the reason.
 * A private app is 404 to everyone but its owner, so strangers learn nothing.
 */
const appTarget = (apps, auth, id, request) => {
  let record
  try {
    record = apps.record(id)
  } catch {
    return { status: 404, message: `no app ${id}` }
  }
  if (record.kind === 'site') return { status: 404, message: `no app ${id}` }
  if (!record.public && auth.owner(request.headers.cookie, id) !== record.owner)
    return { status: 404, message: `no app ${id}` }
  if (record.state === 'crashed')
    return { status: 503, message: `${id} crashed; see its status` }
  return { record }
}

/** The request's headers for the app: our cookie gone, forwarding added. */
const forwarded = request => {
  const headers = {
    ...request.headers,
    'x-forwarded-for': request.socket.remoteAddress,
    'x-forwarded-host': request.headers.host ?? ''
  }
  const cookie = without_app_cookie(request.headers.cookie)
  if (cookie) headers.cookie = cookie
  else delete headers.cookie
  return headers
}

/** A ticket from POST /v1/apps/<id>/enter becomes the owner's cookie, on the app's host. */
const enterApp = (auth, id, url, response) => {
  const cookie = auth.enter(url.searchParams.get('ticket') ?? '', id)
  if (!cookie)
    return plain(
      response,
      HTTP.FORBIDDEN,
      'that link is used or expired; ask for a new one'
    )
  send(
    response,
    HTTP.FOUND,
    { 'set-cookie': cookie, location: '/', 'cache-control': 'no-store' },
    Buffer.alloc(0)
  )
}

const proxyApp = (apps, auth, id, request, response) => {
  const url = new URL(request.url, 'http://app')
  if (url.pathname === ENTER) {
    request.resume()
    return enterApp(auth, id, url, response)
  }
  const { record, status, message } = appTarget(apps, auth, id, request)
  if (!record) {
    request.resume()
    return plain(response, status, message)
  }
  const upstream = http_request(
    {
      host: record.address,
      port: record.port,
      method: request.method,
      path: request.url,
      headers: forwarded(request)
    },
    reply => {
      response.writeHead(reply.statusCode, reply.rawHeaders)
      reply.pipe(response)
    }
  )
  upstream.on('error', error => {
    if (response.headersSent) return response.destroy()
    plain(
      response,
      HTTP.BAD_GATEWAY,
      `${id} is not answering: ${error.code ?? error.message}`
    )
  })
  request.pipe(upstream)
}

/** A WebSocket (or any) upgrade: replay the request head, then splice the sockets. */
const upgradeApp = (apps, auth, request, socket, head) => {
  const id = appOfHost(request.headers.host)
  const { record } = id ? appTarget(apps, auth, id, request) : {}
  if (!record)
    return socket.end('HTTP/1.1 404 Not Found\r\ncontent-length: 0\r\n\r\n')
  const upstream = connect(record.port, record.address, () => {
    const lines = [`${request.method} ${request.url} HTTP/1.1`]
    for (const [name, value] of Object.entries(forwarded(request)))
      for (const one of [value].flat()) lines.push(`${name}: ${one}`)
    upstream.write(`${lines.join('\r\n')}\r\n\r\n`)
    if (head?.length) upstream.write(head)
    upstream.pipe(socket).pipe(upstream)
  })
  const close = () => {
    upstream.destroy()
    socket.destroy()
  }
  upstream.on('error', close)
  socket.on('error', close)
}

const APP_TREE = '/brayness/work/'
/** A path inside the actor's work tree, with no NUL to cut it short. */
const in_app_tree = path =>
  typeof path === 'string' &&
  path.length > APP_TREE.length &&
  path.startsWith(APP_TREE) &&
  !path.includes('\0')

const startApp = async (store, apps, owner, actor, request) => {
  const payload = await readJson(request)
  const { path } = payload
  if (typeof payload.actor !== 'string')
    throw new BadRequest('actor must be an actor id')
  if (
    typeof path !== 'string' ||
    !in_app_tree(path) ||
    path.split('/').includes('..')
  )
    throw new BadRequest(
      'path must sit under /brayness/work, with no .. segments'
    )
  const { id } = actor(payload.actor)
  if (!can({ phone: owner }, 'write', `people/${owner}/harnesses/${id}`))
    throw new NotFound(id)
  return apps.startFrom(dest => store.copyOut(id, path, dest), {
    owner,
    actor: id,
    path
  })
}

const route = async (
  { store, apps, auth, loops, chat, startup },
  request,
  response
) => {
  const url = new URL(request.url, 'http://host')
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const { method } = request

  const appId = apps && appOfHost(request.headers.host)
  if (appId) return proxyApp(apps, auth, appId, request, response)
  const [label, ...rest] = (request.headers.host ?? '').split(':')[0].split('.')
  if (
    method === 'GET' &&
    rest.join('.') === 'localhost' &&
    label.startsWith('a-')
  )
    return site(store, response, label, url.pathname.replace(/^\/+/, ''))

  if (method === 'GET' && path === '/v1/health')
    return json(response, HTTP.OK, health(store))

  let owner
  if (path.startsWith('/v1/')) {
    const pass = request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1]
    try {
      owner = verify_host_pass(pass, process.env.HOST_PASS_SECRET).phone
    } catch {
      return json(response, HTTP.UNAUTHORIZED, {
        error: 'valid host pass required'
      })
    }
  }
  const owns = record =>
    record.owner === owner &&
    can(
      { phone: owner },
      'get',
      `people/${record.owner}/harnesses/${record.id}`
    )
  const actor = id => {
    const record = store.get(id)
    if (!owns(record)) throw new NotFound(id)
    return record
  }

  if (method === 'POST' && path === '/v1/startup')
    return startup.start(owner, await readJson(request), response)

  if (chat && path.startsWith('/v1/actors/')) {
    const [id, kind, what, extra] = path.slice('/v1/actors/'.length).split('/')
    if (kind === 'chat') {
      actor(id)
      if (extra === undefined && what === 'events' && method === 'GET')
        return chat.events(id, response)
      if (extra === undefined && what === 'limit' && method === 'GET')
        return chat.limit(id, response)
      if (extra === undefined && what === 'message' && method === 'POST') {
        if (!can({ phone: owner }, 'write', `people/${owner}/harnesses/${id}`))
          throw new NotFound(id)
        return chat.message(id, request, response)
      }
      if (extra === undefined && what === 'command' && method === 'POST') {
        if (!can({ phone: owner }, 'write', `people/${owner}/harnesses/${id}`))
          throw new NotFound(id)
        return chat.command(id, request, response)
      }
      throw new NotFound(id)
    }
  }

  const app = id => {
    const record = apps.record(id)
    if (record.owner !== owner) throw new NotFound(id)
    return record
  }
  if (path.startsWith('/v1/loops') && !loops) throw new NotFound('loops')
  if (path === '/v1/loops' && method === 'GET')
    return json(response, HTTP.OK, { loops: loops.of_owner(owner) })
  if (path.startsWith('/v1/loops/') && method === 'POST') {
    const [id, action] = path.slice('/v1/loops/'.length).split('/')
    if (action !== 'stop' || !loops.loops[id]) throw new NotFound(id)
    actor(id)
    if (loops.loops[id].status !== 'running')
      return json(response, HTTP.CONFLICT, {
        error: `loop is ${loops.loops[id].status}`
      })
    await loops.stop(id, 'owner')
    return json(
      response,
      HTTP.OK,
      loops.of_owner(owner).find(loop => loop.id === id)
    )
  }
  if (path.startsWith('/v1/apps') && !apps) throw new NotFound('apps')
  if (path === '/v1/apps' && method === 'GET')
    return json(response, HTTP.OK, {
      apps: apps.list().filter(record => record.owner === owner)
    })
  if (path === '/v1/apps' && method === 'POST')
    return json(
      response,
      HTTP.CREATED,
      await startApp(store, apps, owner, actor, request)
    )
  if (path.startsWith('/v1/apps/')) {
    const [id, action] = path.slice('/v1/apps/'.length).split('/')
    app(id)
    if (method === 'GET' && !action)
      return json(response, HTTP.OK, await apps.status(id))
    if (method === 'POST' && action === 'enter') {
      request.resume()
      const port = request.headers.host?.split(':')[1]
      return json(response, HTTP.OK, {
        url: `http://${id}.localhost${port ? `:${port}` : ''}${ENTER}?ticket=${auth.issue(owner, id)}`
      })
    }
    if (method === 'POST' && action === 'visibility') {
      const payload = await readJson(request)
      if (typeof payload.public !== 'boolean')
        throw new BadRequest('public must be true or false')
      return json(response, HTTP.OK, await apps.setPublic(id, payload.public))
    }
    if (method === 'DELETE' && !action) {
      await apps.stop(id)
      return json(response, HTTP.NO_CONTENT)
    }
  }

  if (method === 'GET') {
    if (path === '/v1/actors')
      return json(response, HTTP.OK, { actors: store.list().filter(owns) })
    if (path === '/v1/exports')
      return json(response, HTTP.OK, {
        exports: store
          .exports()
          .filter(
            item =>
              item.actor?.owner === owner &&
              can(
                { phone: owner },
                'get',
                `people/${owner}/harnesses/${item.id}`
              )
          )
      })
    if (url.pathname.startsWith('/s/')) {
      const [id, ...parts] = url.pathname.slice(3).split('/')
      return site(store, response, id, parts.join('/'))
    }
    if (path.startsWith('/v1/actors/')) {
      const [id, action] = path.slice('/v1/actors/'.length).split('/')
      actor(id)
      if (action === 'trace')
        return json(response, HTTP.OK, { events: store.traceOf(id) })
      if (action === undefined) return json(response, HTTP.OK, store.get(id))
    }
  }

  if (method === 'POST') {
    if (path === '/v1/actors') {
      const payload = await readJson(request)
      if (!can({ phone: owner }, 'write', `people/${owner}/harnesses`))
        throw new NotFound('actor')
      const paths = payload.paths ?? null
      if (
        paths !== null &&
        (!Array.isArray(paths) ||
          paths.length > MAX_PATHS ||
          !paths.every(limit_path))
      )
        throw new BadRequest('paths must be relative paths without secrets')
      if (payload.restore_from === undefined || payload.restore_from === null)
        return json(
          response,
          HTTP.CREATED,
          await store.create(owner, { paths })
        )
      if (typeof payload.restore_from !== 'string' || !payload.restore_from)
        throw new BadRequest('restore_from must be an export id')
      return json(
        response,
        HTTP.CREATED,
        await store.restore(payload.restore_from, owner)
      )
    }
    if (path.startsWith('/v1/actors/')) {
      const [id, action] = path.slice('/v1/actors/'.length).split('/')
      actor(id)
      if (!can({ phone: owner }, 'write', `people/${owner}/harnesses/${id}`))
        throw new NotFound(id)
      if (action === 'exec')
        return json(response, HTTP.OK, await exec(store, request, id))
      if (action === 'idle') {
        const payload = await readJson(request)
        const tier = payload.tier || 'memory'
        if (typeof tier !== 'string')
          throw new BadRequest('tier must be a string')
        return json(response, HTTP.OK, await store.idle(id, tier))
      }
      if (action === 'reload')
        return json(response, HTTP.OK, await store.reload(id))
      if (action === 'export')
        return json(response, HTTP.OK, await store.export(id))
      if (action === 'publish') {
        const payload = await readJson(request)
        const tree = payload.path ?? '/brayness/site'
        if (typeof tree !== 'string')
          throw new BadRequest('path must be a string')
        return json(
          response,
          HTTP.OK,
          await store.publish(id, tree || '/brayness/site')
        )
      }
    }
  }

  if (method === 'DELETE' && path.startsWith('/v1/actors/')) {
    const id = path.split('/').at(-1)
    actor(id)
    if (!can({ phone: owner }, 'delete', `people/${owner}/harnesses/${id}`))
      throw new NotFound(id)
    await store.destroy(id)
    return json(response, HTTP.NO_CONTENT)
  }

  request.resume()
  json(response, HTTP.NOT_FOUND, { error: `no route for ${method} ${path}` })
}

/** `apps` is an AppStore; without one, /v1/apps answers 404. */
export const makeServer = (
  store,
  apps = null,
  auth = apps && app_auth(process.env.HOST_PASS_SECRET),
  loops = null,
  {
    connectChat = record => vsock.connect(record.vsockPath, 55),
    limits = null
  } = {}
) => {
  const chat = chat_handlers({ store, connect: connectChat, limits })
  const startup = startup_handlers({ store })
  const server = create_server(async (request, response) => {
    try {
      await route(
        { store, apps, auth, loops, chat, startup },
        request,
        response
      )
    } catch (error) {
      request.resume()
      if (error instanceof BadRequest)
        return json(response, HTTP.BAD_REQUEST, { error: error.message })
      if (error instanceof NotFound)
        return json(response, HTTP.NOT_FOUND, { error: 'no such actor' })
      if (HOST_FAILURES.some(kind => error instanceof kind)) {
        LOG.warn(`request failed: ${error.message}`)
        return json(response, HTTP.INTERNAL_ERROR, { error: error.message })
      }
      LOG.error('request failed', error)
      json(response, HTTP.INTERNAL_ERROR, {
        error: `${error.name}: ${error.message}`
      })
    }
  })
  server.on('upgrade', (request, socket, head) =>
    apps ? upgradeApp(apps, auth, request, socket, head) : socket.destroy()
  )
  return server
}
