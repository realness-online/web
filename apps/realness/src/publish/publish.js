import { randomBytes as random_bytes } from 'node:crypto'
import { readFile as read_file, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { skipped } from '#root/src/files/skip.js'
import { token_source } from '#root/src/sign-on/node/login.js'
import { build_app } from './view.js'
import { HTTP } from '#root/lib/http.js'
import { ID_BYTES, MIB } from '#root/lib/units.js'
import { has_control } from '#root/lib/path-parts.js'
/* eslint-disable no-await-in-loop -- site files upload one at a time to bound memory */

const LIMIT_MIB = 10

/** Prefix local URLs so each site works beneath its own stable address. */
export const site_links = (text, prefix) => {
  const route = path =>
    path.startsWith(prefix) ? path : `${prefix}${path.slice(1)}`
  return text
    .replace(
      /(["'])\/(?!\/)([^\s"'<>]*)/g,
      (_, quote, path) => `${quote}${route(`/${path}`)}`
    )
    .replace(
      /url\(\/(?!\/)([^)]*)\)/g,
      (_, path) => `url(${route(`/${path}`)})`
    )
    .replace(
      /<loc>\/(?!\/)([^<]*)<\/loc>/g,
      (_, path) => `<loc>${route(`/${path}`)}</loc>`
    )
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
      if (
        skipped(name) ||
        name.includes('\\') ||
        name.includes('%') ||
        has_control(name)
      )
        throw new Error(`not publishable: ${name}`)
      const file = join(directory, entry.name)
      if (entry.isDirectory()) await walk(file, name)
      else if (entry.isFile()) {
        let bytes = await read_file(file)
        if (
          /\.(html|fragment|webmanifest|css|xml|txt)$/.test(name) ||
          /^scripts\/(plan-covers|diagrams|detect|pwa)\.js$/.test(name)
        ) {
          const text = site_links(bytes.toString('utf8'), prefix)
          bytes = Buffer.from(text)
        }
        if (bytes.length > LIMIT_MIB * MIB)
          throw new Error(`publish file too large: ${name}`)
        files.push({ name, bytes })
      } else throw new Error(`links cannot be published: ${name}`)
    }
  }
  await walk(directory)
  if (!files.some(file => file.name === 'index.html'))
    throw new Error('publish needs index.html')
  return files
}

/**
 * Publish is explicit. Failed uploads never replace the previous active version.
 * `site_url` is where people read the site (s1: never the app address); writes
 * still go to `url`.
 * @param {string} root
 * @param {string} name
 * @param {object} [options]
 * @param {string} [options.url] the sync URL that receives the files; the
 *   guard below rejects a call without one
 * @param {string | null} [options.site_url] where readers load the site from;
 *   null falls back to `url`
 * @param {() => Promise<string | null>} [options.get_token]
 * @param {typeof fetch} [options.fetcher]
 * @param {string} [options.example] an engine directory to build from,
 *   instead of the app's own sources
 */
export const publish_app = async (
  root,
  name,
  {
    url,
    site_url = url,
    get_token = token_source(),
    fetcher = fetch,
    example
  } = {}
) => {
  if (!url || !/^https?:\/\//.test(url))
    throw new Error('publish needs a sync URL')
  const base = url.replace(/\/$/, '')
  const reads_from = (site_url ?? url).replace(/\/$/, '')
  const built = await build_app(root, name, { example })
  const prefix = `/sites/${built.id}/`
  const files = await snapshot(built.dist, prefix)
  const version = random_bytes(ID_BYTES).toString('hex')
  let pass
  const authorize = async () => {
    const token = await get_token()
    if (!token) throw new Error('not signed in; run realness-store login')
    const response = await fetcher(`${base}/v1/halo-pass`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` }
    })
    if (!response.ok) throw new Error(`publish sign-in: ${response.status}`)
    ;({ pass } = await response.json())
  }
  await authorize()
  const call = async (method, path, body) => {
    const request = () =>
      fetcher(`${base}/v1/sites/${built.id}/${path}`, {
        method,
        headers: { authorization: `Bearer ${pass}` },
        body
      })
    let response = await request()
    if (response.status === HTTP.UNAUTHORIZED) {
      await authorize()
      response = await request()
    }
    if (!response.ok)
      throw new Error(`publish ${method} ${path}: ${response.status}`)
    return response
  }
  for (const { name, bytes } of files) {
    const encoded = name.split('/').map(encodeURIComponent).join('/')
    await call('PUT', `versions/${version}/files/${encoded}`, bytes)
  }
  await call('POST', 'activate', version)
  const reads = reads_from
  const sources = built.sources.map(source => {
    const route = source.route.slice(1)
    return { id: source.id, url: `${reads}${prefix}${route}` }
  })
  return {
    id: built.id,
    version,
    url: `${reads}${prefix}`,
    files: files.length,
    sources
  }
}

/**
 * Remove the active public snapshot; private files are unchanged.
 * @param {string} id the app id
 * @param {object} options
 * @param {string} [options.url] the sync URL
 * @param {() => Promise<string | null>} [options.get_token]
 * @param {typeof fetch} [options.fetcher]
 */
export const unpublish_app = async (
  id,
  { url, get_token = token_source(), fetcher = fetch } = {}
) => {
  if (!/^a-[a-f0-9]{12}$/.test(id)) throw new Error('invalid app id')
  if (!url) throw new Error('unpublish needs a sync URL')
  const token = await get_token()
  if (!token) throw new Error('not signed in; run realness-store login')
  const base = url.replace(/\/$/, '')
  const authorized = await fetcher(`${base}/v1/halo-pass`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` }
  })
  if (!authorized.ok) throw new Error(`publish sign-in: ${authorized.status}`)
  const { pass } = await authorized.json()
  const response = await fetcher(`${base}/v1/sites/${id}/active`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${pass}` }
  })
  if (!response.ok) throw new Error(`unpublish: ${response.status}`)
  return response.json()
}
