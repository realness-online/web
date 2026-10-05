// Public static sites, stored with their versions in sync's bucket.
// Only a host holding a signed owner pass may change a site.
const ID = /^a-[a-f0-9]{12}$/
const VERSION = /^[a-f0-9]{12}$/
const MIME = { html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", json: "application/json", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", ico: "image/x-icon", txt: "text/plain; charset=utf-8", woff2: "font/woff2", pdf: "application/pdf" }

export class SiteError extends Error {
  constructor(status) { super(String(status)); this.status = status }
}

const owner_key = (id) => `sites/${id}/owner`
const active_key = (id) => `sites/${id}/active`
const file_key = (id, version, path) => `sites/${id}/versions/${version}/files/${path}`
const safe_path = (path) => path && path.length <= 1024 && path.split("/").every((part) => part && part !== "." && part !== ".." && !/[\\%\0\x00-\x1f]/.test(part))
const send = (response, status, body = "", headers = {}) => response.writeHead(status, { "x-content-type-options": "nosniff", ...headers }).end(body)

export const site_request = async ({ storage, method, path, who, response, read_body }) => {
  const parts = path.split("/")
  const public_site = parts[0] === "sites"
  const [root, id] = public_site ? parts : parts.slice(1)
  if ((public_site && method !== "GET") || !ID.test(id ?? "")) throw new SiteError(404)
  if (!public_site && (root !== "sites" || parts[0] !== "v1" || !who?.phone)) throw new SiteError(403)

  if (public_site) {
    const relative = parts.slice(2).join("/")
    const name = relative && !relative.endsWith("/") ? relative : `${relative}index.html`
    if (!safe_path(name)) throw new SiteError(403)
    const active = await storage.get(active_key(id))
    if (!active) throw new SiteError(404)
    const version = active.body.toString("utf8")
    if (!VERSION.test(version)) throw new SiteError(500)
    let file = await storage.get(file_key(id, version, name))
    let served = name
    if (!file && !name.includes(".") && !relative.endsWith("/")) {
      served = `${name}/index.html`
      file = await storage.get(file_key(id, version, served))
      if (!file) {
        served = `${name}.html`
        file = await storage.get(file_key(id, version, served))
      }
    }
    if (!file) throw new SiteError(404)
    return send(response, 200, file.body, { "content-type": MIME[served.split(".").at(-1).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-cache" })
  }

  const owner = await storage.get(owner_key(id))
  if (owner && owner.body.toString("utf8") !== who.phone) throw new SiteError(403)
  const tail = parts.slice(3)
  if (method === "PUT" && tail[0] === "versions" && VERSION.test(tail[1] ?? "") && tail[2] === "files") {
    const name = tail.slice(3).join("/")
    if (!safe_path(name)) throw new SiteError(403)
    if (!owner) {
      try { await storage.put(owner_key(id), who.phone, { if_version: null }) }
      catch (error) {
        if (error.code !== "conflict") throw error
        if ((await storage.get(owner_key(id)))?.body.toString("utf8") !== who.phone) throw new SiteError(403)
      }
    }
    try { await storage.put(file_key(id, tail[1], name), await read_body(), { if_version: null }) }
    catch (error) { if (error.code === "conflict") throw new SiteError(409); throw error }
    return send(response, 201)
  }
  if (!owner) throw new SiteError(404)
  if (method === "GET" && tail.join("/") === "versions") {
    const listing = await storage.list(`sites/${id}/versions/`)
    const current = (await storage.get(active_key(id)))?.body.toString("utf8")
    const versions = await Promise.all(listing.folders.filter((version) => VERSION.test(version) && version !== current).map(async (version) => ({ id: version, saved: (await storage.get(`sites/${id}/versions/${version}/saved`))?.body.toString("utf8") ?? "" })))
    return send(response, 200, JSON.stringify(versions.sort((a, b) => b.saved.localeCompare(a.saved))), { "content-type": "application/json" })
  }
  if (method === "POST" && tail.join("/") === "activate") {
    const version = (await read_body()).toString("utf8")
    if (!VERSION.test(version)) throw new SiteError(400)
    if (!await storage.get(file_key(id, version, "index.html"))) throw new SiteError(404)
    await storage.put(`sites/${id}/versions/${version}/saved`, new Date().toISOString(), { if_version: null }).catch((error) => { if (error.code !== "conflict") throw error })
    await storage.put(active_key(id), version)
    return send(response, 200, JSON.stringify({ url: `/sites/${id}/`, version }), { "content-type": "application/json" })
  }
  if (method === "DELETE" && tail.join("/") === "active") {
    const active = await storage.get(active_key(id))
    if (!active) throw new SiteError(404)
    await storage.delete(active_key(id))
    return send(response, 200, JSON.stringify({ version: active.body.toString("utf8") }), { "content-type": "application/json" })
  }
  throw new SiteError(405)
}
