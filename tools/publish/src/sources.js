/**
 * Which vault files an app shows.
 *
 * A source is a file plus the identity that outlives its path: a plan moves
 * from one folder to another and its app entry, and its published link, stay
 * the same. Paths are settings; identities are the record.
 *
 *   apps/<name>/app.json
 *     id       the app's published identity (a-xxxxxxxxxxxx)
 *     vault    the vault, relative to the app folder
 *     sources  [{ id, slug }]  what the app shows and at which route
 *     assets   [{ id, path }]  vault files copied into the build, e.g. posters
 */
import { randomBytes as random_bytes, randomUUID as random_uuid } from 'node:crypto'
import { lstat, mkdir, readFile as read_file, realpath, rename, rm, writeFile as write_file } from 'node:fs/promises'
import { existsSync as exists_sync } from 'node:fs'
import { dirname, isAbsolute as is_absolute, join, relative, resolve } from 'node:path'

export const APP = 'app.json'
export const CATALOG = 'catalog.json'
/** Routes are one or more path segments; no dots, no traversal, no spaces.
 * Capitals stay: published links like /blog/DOM-the-ORM are case-sensitive. */
const SLUG = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)*$/
const ID = /^[0-9a-f-]{8,64}$/

/** A vault-relative path that cannot leave the vault on its own. */
export const relative_path = (path) => {
  if (typeof path !== 'string' || !path || is_absolute(path)) throw new Error(`unsafe path: ${path}`)
  const parts = path.split('/')
  if (!parts.length || parts.some((part) => !part || part === '.' || part === '..' || /[\\\0]/.test(part))) throw new Error(`unsafe path: ${path}`)
  return path
}

/** Resolve through links, then prove the result is still inside the vault. */
export const source_file = async (vault, path) => {
  const root = await realpath(vault)
  const file = await realpath(join(root, relative_path(path)))
  const inside = relative(root, file)
  if (!inside || inside.startsWith('..') || is_absolute(inside)) throw new Error(`outside the vault: ${path}`)
  if (!(await lstat(file)).isFile()) throw new Error(`not a file: ${path}`)
  return file
}

export const new_id = () => random_uuid()
export const new_app_id = () => `a-${random_bytes(6).toString('hex')}`

/** The vault's catalog: identity to path, kind, and tags. A missing one is empty. */
export const read_catalog = async (vault) => {
  let value
  try {
    value = JSON.parse(await read_file(join(vault, CATALOG), 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return { version: 1, sources: {} }
  }
  if (value.version !== 1 || !value.sources || typeof value.sources !== 'object' || Array.isArray(value.sources)) throw new Error('invalid catalog')
  return value
}

/** Written whole, through a temporary name, so a crash cannot leave half a catalog. */
export const write_catalog = async (vault, value) => {
  await mkdir(vault, { recursive: true })
  const temporary = join(vault, `${CATALOG}.tmp`)
  await write_file(temporary, `${JSON.stringify(value, null, 2)}\n`)
  await rename(temporary, join(vault, CATALOG))
}

/** A vault file the apps may show. The catalog file itself is never a source. */
export const add_source = async (vault, path, { id = new_id(), kind = 'article', tags = [] } = {}) => {
  relative_path(path)
  if (path === CATALOG) throw new Error('the catalog is not a source')
  await source_file(vault, path)
  if (!ID.test(id) || !Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) throw new Error('bad id or tags')
  const value = await read_catalog(vault)
  if (value.sources[id] && value.sources[id].path !== path) throw new Error(`identity already names another file: ${id}`)
  const taken = Object.entries(value.sources).find(([, source]) => source.path === path)
  if (taken && taken[0] !== id) throw new Error(`file already has an identity: ${path}`)
  value.sources[id] = { path, kind, tags: [...new Set(tags)].sort() }
  await write_catalog(vault, value)
  return { id, ...value.sources[id] }
}

/** One file, several classifiers: kind and tags answer different questions. */
export const classify_source = async (vault, id, { kind, tags = [] } = {}) => {
  const value = await read_catalog(vault)
  const source = value.sources[id]
  if (!source) throw new Error(`unknown source: ${id}`)
  if (kind !== undefined) source.kind = kind
  for (const tag of tags) if (!source.tags.includes(tag)) source.tags.push(tag)
  source.tags.sort()
  await write_catalog(vault, value)
  return source
}

/** Move the file and rename its identity in one step, or neither. */
export const move_source = async (vault, id, path) => {
  const value = await read_catalog(vault)
  const source = value.sources[id]
  if (!source) throw new Error(`unknown source: ${id}`)
  const from = await source_file(vault, source.path)
  const to = resolve(vault, relative_path(path))
  if (exists_sync(to)) throw new Error(`destination exists: ${path}`)
  await mkdir(dirname(to), { recursive: true })
  const parent = await realpath(dirname(to))
  if (relative(await realpath(vault), parent).startsWith('..')) throw new Error(`outside the vault: ${path}`)
  await rename(from, to)
  const previous = source.path
  source.path = path
  try {
    await write_catalog(vault, value)
  } catch (error) {
    await rename(to, from)
    source.path = previous
    throw error
  }
}

/** What `apps/<name>/app.json` holds. */
export const read_app = async (app_dir) => {
  const value = JSON.parse(await read_file(join(app_dir, APP), 'utf8'))
  if (!/^a-[a-f0-9]{12}$/.test(value.id)) throw new Error('app needs an id like a-0123456789ab')
  if (!['blog', 'plans'].includes(value.type)) throw new Error('app type is blog or plans')
  value.vault ??= '../../vault'
  value.sources ??= []
  value.assets ??= []
  if (typeof value.vault !== 'string' || !Array.isArray(value.sources) || !Array.isArray(value.assets)) throw new Error('invalid app recipe')
  return value
}

export const write_app = async (app_dir, value) => {
  await mkdir(app_dir, { recursive: true })
  await write_file(join(app_dir, APP), `${JSON.stringify(value, null, 2)}\n`)
}

/**
 * One app's sources, resolved: the catalog entry joined with the file on disk.
 * A route appears once; a source must exist and be readable.
 */
export const app_sources = async (app_dir) => {
  const app = await read_app(app_dir)
  const vault = resolve(app_dir, app.vault)
  const catalog = await read_catalog(vault)
  const slugs = new Set()
  const routes = new Set()
  const sources = []
  for (const selection of app.sources) {
    if (typeof selection.id !== 'string' || !SLUG.test(selection.slug ?? '')) throw new Error(`bad selection: ${selection.slug}`)
    if (slugs.has(selection.slug)) throw new Error(`route already used: ${selection.slug}`)
    slugs.add(selection.slug)
    const source = catalog.sources[selection.id]
    if (!source) throw new Error(`app names a source the vault does not have: ${selection.id}`)
    const file = await source_file(vault, source.path)
    const route = `/blog/${selection.slug}`
    if (routes.has(route)) throw new Error(`route already used: ${route}`)
    routes.add(route)
    sources.push({ ...selection, ...source, file, route })
  }
  const assets = []
  for (const selection of app.assets) {
    relative_path(selection.path)
    const source = catalog.sources[selection.id]
    if (!source) throw new Error(`app names an asset the vault does not have: ${selection.id}`)
    assets.push({ ...source, ...selection, file: await source_file(vault, source.path) })
  }
  return { app, vault, sources, assets }
}

/** Files a build copies into the page, checked before any of them is copied. */
export const app_assets = async (app_dir) => {
  return (await app_sources(app_dir)).assets
}

export const remove_source = async (vault, id) => {
  const value = await read_catalog(vault)
  if (!value.sources[id]) throw new Error(`unknown source: ${id}`)
  delete value.sources[id]
  await write_catalog(vault, value)
}

export const catalog_file = async (dir) => {
  await rm(join(dir, `${CATALOG}.tmp`), { force: true })
}
