/**
 * Which vault files an app shows. The vault is the catalog.
 *
 * Every addressed file carries its own itemid - a frontmatter line in a note,
 * the root attribute of SVG or HTML - so a move, a rename, or an edit made
 * anywhere keeps its identity. Apps name items by itemid; a scan of the vault
 * finds the file. Nothing else records where a file lives.
 *
 *   apps/<name>/app.json
 *     id       the app's published identity (a-xxxxxxxxxxxx)
 *     vault    the vault, relative to the app folder
 *     sources  [{ id, slug }]  what the app shows and at which route
 *     assets   [{ id, path }]  vault files copied into the build, e.g. posters
 *     pages    [{ id, path, files: [{ from, path }] }]  full HTML and its selected files
 */
import { randomBytes as random_bytes } from 'node:crypto'
import { lstat, mkdir, open, readdir, readFile as read_file, realpath, stat, utimes, writeFile as write_file } from 'node:fs/promises'
import { isAbsolute as is_absolute, join, relative, resolve } from 'node:path'
import { as_created_at, as_type, is_itemid, made_elsewhere, mint } from './itemid.js'

export const APP = 'app.json'
/** Routes are one or more path segments; no dots, no traversal, no spaces.
 * Capitals stay: published links like /blog/DOM-the-ORM are case-sensitive. */
const SLUG = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)*$/

/** Files that can carry their own itemid. Others join the vault through a wrapper. */
const CARRIES = /\.(md|svg|html)$/

/** Enough of a file to hold its frontmatter or its root element. */
const HEAD = 8192

/** The itemid a file carries: a frontmatter line in a note, the root attribute of SVG or HTML.
 * Frontmatter counts only at the very start; a `---` rule in the body is not frontmatter. */
export const carried_itemid = (text) => {
  const front = text.match(/^---\n([\s\S]*?)\n?---(?:\n|$)/)?.[1] ?? ''
  return front.match(/^itemid: *"?([^"\n]+?)"? *$/m)?.[1] ?? text.match(/<(?:svg|html)\b[^>]*?\sitemid="([^"]+)"/)?.[1] ?? null
}

const pad = (n) => String(n).padStart(2, '0')

/** Local time with its offset, the form the clipper and Dataview read. */
const local_time = (ms) => {
  const date = new Date(ms)
  const offset = -date.getTimezoneOffset()
  const sign = offset < 0 ? '-' : '+'
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
}

/**
 * Write an itemid into the file that owns it. A note gains `itemid` and, when
 * missing, a `created` copy for Dataview; SVG and HTML gain a root attribute.
 * `replacing` swaps a copied itemid for the copy's own. The modification time stays.
 */
export const carry_itemid = async (file, id, replacing) => {
  const { atime, mtime } = await stat(file)
  await write_itemid(file, id, replacing, await read_file(file, 'utf8'))
  await utimes(file, atime, mtime)
}

const write_itemid = async (file, id, replacing, text) => {
  if (replacing) {
    const own = text.replace(replacing, id)
    return write_file(file, file.endsWith('.md') ? own.replace(/^created: .*$/m, `created: ${local_time(as_created_at(id))}`) : own)
  }
  if (file.endsWith('.md')) {
    const created = `created: ${local_time(as_created_at(id))}`
    const front = text.match(/^---\n([\s\S]*?)\n?---(?:\n|$)/)
    if (!front) return write_file(file, `---\nitemid: "${id}"\n${created}\n---\n${text}`)
    const lines = [`itemid: "${id}"`, ...(/^created:/m.test(front[1]) ? [] : [created])]
    return write_file(file, `---\n${lines.join('\n')}\n${text.slice(4)}`)
  }
  const root = text.match(/<(svg|html)\b/)
  if (!root) throw new Error(`no root element to carry an itemid: ${file}`)
  return write_file(file, text.replace(root[0], `${root[0]} itemid="${id}"`))
}

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

const head = async (file) => {
  const handle = await open(file, 'r')
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(HEAD), 0, HEAD, 0)
    return buffer.subarray(0, bytesRead).toString('utf8')
  } finally {
    await handle.close()
  }
}

/** Every file in the vault that could carry an itemid; dot folders are not the vault's. */
const carriers = async (vault, dir = '') => {
  const files = []
  for (const entry of await readdir(join(vault, dir), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const path = dir ? `${dir}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...(await carriers(vault, path)))
    else if (entry.isFile() && CARRIES.test(entry.name)) files.push(path)
  }
  return files
}

/**
 * The vault's items: each itemid with the file that carries it. Two files with
 * one itemid are an original and its copy; the older file is the original.
 * `copies` lists the rest, for `mint_item` to give their own. Items made
 * elsewhere (Realness posters, thoughts) may sit in several files: `views`
 * lists them all, and none is a copy.
 */
export const scan_vault = async (vault) => {
  const found = new Map()
  for (const path of await carriers(vault)) {
    const id = carried_itemid(await head(join(vault, path)))
    if (!id || !is_itemid(id)) continue
    const born = (await stat(join(vault, path))).birthtimeMs
    found.set(id, [...(found.get(id) ?? []), { path, born }])
  }
  const items = new Map()
  const views = new Map()
  const copies = []
  for (const [id, files] of found) {
    files.sort((a, b) => a.born - b.born || a.path.localeCompare(b.path))
    items.set(id, files[0].path)
    views.set(id, files.map((file) => file.path))
    if (made_elsewhere.includes(as_type(id))) continue
    for (const copy of files.slice(1)) copies.push({ id, path: copy.path })
  }
  return { items, views, copies }
}

/** A fresh itemid: the next millisecond no item of this type has used. */
const unused = (items, author, type, created) => {
  let ms = created
  while (items.has(`${author}/${type}/${ms}`)) ms++
  return mint(author, type, ms)
}

/**
 * Make a vault file an item. A file that carries an itemid keeps it, unless it
 * is a copy of an older file, which then gets its own. A file with none gets
 * one minted for `author` as `type` at `created`, written into the file.
 */
export const mint_item = async (vault, path, { author, type, created = Date.now(), scan } = {}) => {
  const file = await source_file(vault, path)
  if (!CARRIES.test(path)) throw new Error(`${path} cannot carry an itemid; wrap it in a page or poster`)
  const { items } = scan ?? (await scan_vault(vault))
  const carried = carried_itemid(await head(file))
  const holder = carried && items.get(carried)
  if (carried && (!holder || holder === path || made_elsewhere.includes(as_type(carried)))) {
    items.set(carried, path)
    return carried
  }
  if (!author) throw new Error(`minting an itemid for ${path} needs an author`)
  const id = unused(items, author, carried ? as_type(carried) : type, created)
  await carry_itemid(file, id, carried ?? undefined)
  items.set(id, path)
  return id
}

export const new_app_id = () => `a-${random_bytes(6).toString('hex')}`

/** What `apps/<name>/app.json` holds. */
export const read_app = async (app_dir) => {
  const value = JSON.parse(await read_file(join(app_dir, APP), 'utf8'))
  if (!/^a-[a-f0-9]{12}$/.test(value.id)) throw new Error('app needs an id like a-0123456789ab')
  if (!['blog', 'plans'].includes(value.type)) throw new Error('app type is blog or plans')
  value.vault ??= '../../vault'
  value.sources ??= []
  value.assets ??= []
  value.pages ??= []
  if (typeof value.vault !== 'string' || !Array.isArray(value.sources) || !Array.isArray(value.assets) || !Array.isArray(value.pages)) throw new Error('invalid app recipe')
  return value
}

export const write_app = async (app_dir, value) => {
  await mkdir(app_dir, { recursive: true })
  await write_file(join(app_dir, APP), `${JSON.stringify(value, null, 2)}\n`)
}

/**
 * One app's items, found in the vault by itemid. A route appears once; an item
 * must exist and be readable.
 */
export const app_sources = async (app_dir) => {
  const app = await read_app(app_dir)
  const vault = resolve(app_dir, app.vault)
  const { items, views } = await scan_vault(vault)
  /** `from` pins one file when an item made elsewhere sits in several. */
  const located = async (id, what, from) => {
    const path = from ?? items.get(id)
    if (!path || !views.get(id)?.includes(path)) throw new Error(`app names ${what} the vault does not have: ${id}${from ? ` at ${from}` : ''}`)
    return { path, file: await source_file(vault, path) }
  }
  const slugs = new Set()
  const sources = []
  for (const selection of app.sources) {
    if (typeof selection.id !== 'string' || !SLUG.test(selection.slug ?? '')) throw new Error(`bad selection: ${selection.slug}`)
    if (slugs.has(selection.slug)) throw new Error(`route already used: ${selection.slug}`)
    slugs.add(selection.slug)
    sources.push({ ...selection, ...(await located(selection.id, 'a source', selection.from)), route: `/blog/${selection.slug}` })
  }
  const assets = []
  for (const selection of app.assets) {
    relative_path(selection.path)
    if (selection.from !== undefined) relative_path(selection.from)
    assets.push({ ...selection, file: (await located(selection.id, 'an asset', selection.from)).file })
  }
  const outputs = new Set(['index.html', 'sitemap.xml', 'robots.txt', ...sources.map(source => `blog/${source.slug}/index.html`)])
  const reserve = path => {
    relative_path(path)
    if (outputs.has(path)) throw new Error(`route already used: ${path}`)
    outputs.add(path)
  }
  const pages = []
  const page_files = new Map()
  for (const selection of app.pages) {
    reserve(selection.path)
    if (!selection.path.endsWith('.html') || !is_itemid(selection.id) || as_type(selection.id) !== 'pages') throw new Error('page selection needs an HTML path and page itemid')
    const source = await located(selection.id, 'a page', selection.from)
    if (!source.path.endsWith('.html')) throw new Error(`page is not HTML: ${source.path}`)
    reserve(`${selection.id.slice(1)}/index.html`)
    const files = []
    for (const file of selection.files ?? []) {
      if (page_files.get(file.path) !== file.from) reserve(file.path)
      page_files.set(file.path, file.from)
      files.push({ ...file, file: await source_file(vault, file.from) })
    }
    pages.push({ ...selection, file: source.file, files })
  }
  return { app, vault, sources, assets, pages }
}

/** Files a build copies into the page, checked before any of them is copied. */
export const app_assets = async (app_dir) => {
  return (await app_sources(app_dir)).assets
}
