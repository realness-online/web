import { randomBytes as random_bytes } from 'node:crypto'
import { readFile as read_file, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { skipped } from '../../sync/src/skip.js'
import { token_source } from '../../sync/src/login.js'
import { build_app } from './view.js'

/** Prefix local URLs so each site works beneath its own stable address. */
export const site_links = (text, prefix) => {
  const route = path => path.startsWith(prefix) ? path : `${prefix}${path.slice(1)}`
  return text
    .replace(/(["'])\/(?!\/)([^\s"'<>]*)/g, (_, quote, path) => `${quote}${route(`/${path}`)}`)
    .replace(/url\(\/(?!\/)([^)]*)\)/g, (_, path) => `url(${route(`/${path}`)})`)
    .replace(/<loc>\/(?!\/)([^<]*)<\/loc>/g, (_, path) => `<loc>${route(`/${path}`)}</loc>`)
}

/**
 * Read the complete snapshot before uploading; links and secrets are refused.
 * Vendor JavaScript is not rewritten: a regular expression can look like a URL.
 * @param {string} directory
 * @param {string} prefix
 */
const snapshot = async (directory, prefix) => {
  const files = []
  const walk = async (directory, base = '') => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = base ? `${base}/${entry.name}` : entry.name
      if (skipped(name) || /[\\%\0\x00-\x1f]/.test(name)) throw new Error(`not publishable: ${name}`)
      const file = join(directory, entry.name)
      if (entry.isDirectory()) await walk(file, name)
      else if (entry.isFile()) {
        let bytes = await read_file(file)
        if (/\.(html|css|xml|txt)$/.test(name) || /^scripts\/(plan-covers|diagrams|detect)\.js$/.test(name)) {
          let text = site_links(bytes.toString('utf8'), prefix)
          bytes = Buffer.from(text)
        }
        if (bytes.length > 10 * 1024 * 1024) throw new Error(`publish file too large: ${name}`)
        files.push({ name, bytes })
      } else throw new Error(`links cannot be published: ${name}`)
    }
  }
  await walk(directory)
  if (!files.some(file => file.name === 'index.html')) throw new Error('publish needs index.html')
  return files
}

/** Publish is explicit. Failed uploads never replace the previous active version. */
export const publish_app = async (root, name, { url, get_token = token_source(), fetcher = fetch, example } = {}) => {
  if (!/^https?:\/\//.test(url ?? '')) throw new Error('publish needs a sync URL')
  const base = url.replace(/\/$/, '')
  const built = await build_app(root, name, { example })
  const prefix = `/sites/${built.id}/`
  const files = await snapshot(built.dist, prefix)
  const version = random_bytes(6).toString('hex')
  let pass
  const authorize = async () => {
    const token = await get_token()
    if (!token) throw new Error('not signed in; run brayness-store login')
    const response = await fetcher(`${base}/v1/host-pass`, { method: 'POST', headers: { authorization: `Bearer ${token}` } })
    if (!response.ok) throw new Error(`publish sign-in: ${response.status}`)
    pass = (await response.json()).pass
  }
  await authorize()
  const call = async (method, path, body) => {
    const request = () => fetcher(`${base}/v1/sites/${built.id}/${path}`, { method, headers: { authorization: `Bearer ${pass}` }, body })
    let response = await request()
    if (response.status === 401) {
      await authorize()
      response = await request()
    }
    if (!response.ok) throw new Error(`publish ${method} ${path}: ${response.status}`)
    return response
  }
  for (const { name, bytes } of files) {
    const encoded = name.split('/').map(encodeURIComponent).join('/')
    await call('PUT', `versions/${version}/files/${encoded}`, bytes)
  }
  await call('POST', 'activate', version)
  return { id: built.id, version, url: `${base}${prefix}`, files: files.length, sources: built.sources.map(source => ({ id: source.id, url: `${base}${prefix}blog/${source.slug}/` })) }
}

/** Remove the active public snapshot; private files are unchanged. */
export const unpublish_app = async (id, { url, get_token = token_source(), fetcher = fetch } = {}) => {
  if (!/^a-[a-f0-9]{12}$/.test(id)) throw new Error('invalid app id')
  const token = await get_token()
  if (!token) throw new Error('not signed in; run brayness-store login')
  const base = url.replace(/\/$/, '')
  const authorized = await fetcher(`${base}/v1/host-pass`, { method: 'POST', headers: { authorization: `Bearer ${token}` } })
  if (!authorized.ok) throw new Error(`publish sign-in: ${authorized.status}`)
  const { pass } = await authorized.json()
  const response = await fetcher(`${base}/v1/sites/${id}/active`, { method: 'DELETE', headers: { authorization: `Bearer ${pass}` } })
  if (!response.ok) throw new Error(`unpublish: ${response.status}`)
  return response.json()
}
