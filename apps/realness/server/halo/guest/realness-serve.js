import { createServer as create_server } from 'node:http'
import { Readable } from 'node:stream'

const HANDLER = '/app/code/server.js'
const PORT = Number(process.env.PORT)

const app = (await import(HANDLER)).default
const handle = typeof app === 'function' ? app : app?.fetch?.bind(app)
if (typeof handle !== 'function') {
  console.error(`${HANDLER}: export default { fetch(request) } or a function`)
  process.exit(1)
}

const toRequest = req => {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers))
    for (const one of [value].flat()) headers.append(name, one)

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  /**
   * `duplex` is required by undici for a streaming request body, but the DOM
   * RequestInit type does not carry it.
   * @type {RequestInit & { duplex?: 'half' }}
   */
  const init = {
    method: req.method,
    headers,
    body: hasBody
      ? /** @type {ReadableStream} */ (Readable.toWeb(req))
      : undefined,
    duplex: hasBody ? 'half' : undefined
  }
  return new Request(`http://${req.headers.host ?? 'app'}${req.url}`, init)
}

create_server(async (req, res) => {
  let response
  try {
    response = await handle(toRequest(req))
    if (!(response instanceof Response))
      throw new TypeError('the handler must return a Response')
  } catch (error) {
    console.error(error)
    res.writeHead(500, { 'content-type': 'text/plain' }).end('handler error\n')
    return
  }
  res.writeHead(
    response.status,
    response.statusText,
    [...response.headers].flat()
  )
  if (!response.body || req.method === 'HEAD') return res.end()
  Readable.fromWeb(
    /** @type {import("node:stream/web").ReadableStream} */ (response.body)
  )
    .on('error', () => res.destroy())
    .pipe(res)
}).listen(PORT)
