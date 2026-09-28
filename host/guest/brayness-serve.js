// Brayness's server, the only one an app runs. HTTP on $PORT becomes a web
// Request for the author's handler; its Response streams back. Rides the node
// runtime disk at /opt/runtime/brayness/serve.js, read-only.
//
// Node starts it under --permission (host/src/infer.js): reads only the
// handler's files and this one; no writes, child processes, workers, addons,
// WASI, or inspector. The VM is the wall; this is a second one inside it.
//
//   export default { async fetch(request) { return new Response("hi") } }
//   export default async function (request) { ... }   also accepted

import { createServer } from "node:http"
import { Readable } from "node:stream"

const HANDLER = "/app/code/server.js"
const PORT = Number(process.env.PORT)

const app = (await import(HANDLER)).default
const handle = typeof app === "function" ? app : app?.fetch?.bind(app)
if (typeof handle !== "function") {
  console.error(`${HANDLER}: export default { fetch(request) } or a function`)
  process.exit(1)
}

function toRequest(req) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    for (const one of [value].flat()) headers.append(name, one)
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD"
  return new Request(`http://${req.headers.host ?? "app"}${req.url}`, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  })
}

createServer(async (req, res) => {
  let response
  try {
    response = await handle(toRequest(req))
    if (!(response instanceof Response)) throw new TypeError("the handler must return a Response")
  } catch (error) {
    console.error(error)
    res.writeHead(500, { "content-type": "text/plain" }).end("handler error\n")
    return
  }
  res.writeHead(response.status, response.statusText, [...response.headers].flat())
  if (!response.body || req.method === "HEAD") return res.end()
  Readable.fromWeb(response.body).on("error", () => res.destroy()).pipe(res)
}).listen(PORT)
