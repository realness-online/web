/**
 * Render one app with the product renderer.
 *
 * The product owns Markdown, semantic HTML, microdata, posters, diagrams,
 * and sitemap rendering. Standalone starters are exported from this source.
 * An app owns its choices, site values, static overlay, and plan covers.
 *
 * The build tree is `artifacts/apps/<name>/`: article files are links to the
 * vault, so no original is ever copied. `dist/` there is publishable.
 */
import { execFile as exec_file } from 'node:child_process'
import {
  existsSync as exists_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import {
  cp,
  mkdir,
  readFile as read_file,
  readdir,
  rm,
  symlink,
  writeFile as write_file
} from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { createRequire as create_require } from 'node:module'
import { app_sources } from './sources.js'
import { product_paths } from '#root/src/settings/layout.js'
import { MIB } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- copies run in order so later overlays win */

const LIMIT_MIB = 10

const run = promisify(exec_file)
const MAX = LIMIT_MIB * MIB
const {
  root: project,
  renderer: renderer_path,
  static_preset
} = product_paths()
export { renderer_path }
const product_manifest = join(project, 'package.json')

/** Export a self-contained starter from the versioned product source. */
export const export_static = async destination => {
  if (exists_sync(destination))
    throw new Error(`destination exists: ${destination}`)
  const excluded = new Set(['node_modules', 'dist', '.cache', '.DS_Store'])
  await cp(renderer_path, destination, {
    recursive: true,
    filter: path => !excluded.has(path.split(/[\\/]/).at(-1) ?? '')
  })
  await cp(
    join(static_preset, 'package.json'),
    join(destination, 'package.json')
  )
  await cp(
    join(static_preset, 'package-lock.json'),
    join(destination, 'package-lock.json')
  )
  return destination
}

/**
 * The harness-relative examples folder, from package.json's realness.examples.
 * @param {string} root Harness root.
 * @returns {string} Folder path.
 */
export const examples_path = root => {
  const file = join(root, 'package.json')
  const path = exists_sync(file)
    ? (JSON.parse(read_file_sync(file, 'utf8')).realness?.examples ??
      '.pi/examples')
    : '.pi/examples'
  if (
    typeof path !== 'string' ||
    !path ||
    path.split('/').some(part => !part || part === '.' || part === '..')
  )
    throw new Error(
      'realness.examples must be a relative folder inside the harness'
    )
  return path
}

/**
 * The product renderer, reused by every app; explicit custom renderers remain supported.
 * @param {string} root Harness root.
 * @param {string} [local] An explicit custom renderer directory.
 * @returns {Promise<string>} Renderer directory.
 */
export const engine = async (root, local = process.env.APPS_EXAMPLE) => {
  const directory = local ? resolve(root, local) : renderer_path
  if (!exists_sync(directory)) throw new Error(`no renderer: ${directory}`)
  if (
    !exists_sync(join(directory, 'src/build.js')) ||
    !exists_sync(join(directory, 'static/plans.css'))
  )
    throw new Error(
      `outdated renderer: ${directory}; set APPS_EXAMPLE to the updated static example`
    )
  const manifest =
    directory === renderer_path
      ? product_manifest
      : join(directory, 'package.json')
  const dependencies_file =
    directory === renderer_path ? join(static_preset, 'package.json') : manifest
  const { dependencies = {} } = JSON.parse(
    await read_file(dependencies_file, 'utf8')
  )
  const require = create_require(manifest)
  const installed = Object.keys(dependencies).every(name => {
    try {
      require.resolve(name)
      return true
    } catch {
      return false
    }
  })
  if (!installed) {
    if (directory === renderer_path)
      throw new Error(
        'product renderer dependencies missing; run npm install in the product'
      )
    await run('npm', ['install', '--no-fund', '--no-audit'], {
      cwd: directory,
      maxBuffer: MAX
    })
  }
  return directory
}

/**
 * Copy a folder, refusing anything that is not a file: no links become public.
 * @param {string} from
 * @param {string} to
 */
const copy_files = async (from, to) => {
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = join(from, entry.name)
    const target = join(to, entry.name)
    if (entry.isDirectory()) {
      await mkdir(target, { recursive: true })
      await copy_files(source, target)
    } else if (entry.isFile()) {
      await mkdir(dirname(target), { recursive: true })
      await cp(source, target)
    } else throw new Error(`not a file or folder: ${source}`)
  }
}

/**
 * Build one app into `dist/`. Returns what a publisher needs: the identity,
 * the tree, and the route of every source. A build starts from an empty tree,
 * so a source dropped from app.json cannot survive as a stale page.
 *
 * App overlays never modify the renderer source: the renderer layers its own
 * static/ and partials/ under the app's and keeps only the files this type
 * uses, so an app adds files instead of restating the theme. Explicitly
 * selected assets copy last and override.
 *
 * @param {string} root Harness root.
 * @param {string} name App name.
 * @param {{drafts?: boolean, example?: string}} [options]
 */
export const build_app = async (
  root,
  name,
  { drafts = false, example: local } = {}
) => {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`bad app name: ${name}`)
  const app_dir = join(root, 'apps', name)
  const { app, sources, assets, pages } = await app_sources(app_dir)
  const example = await engine(root, local)
  const output = join(root, 'artifacts/apps', name)
  await rm(output, { recursive: true, force: true })
  await mkdir(join(output, 'content/articles'), { recursive: true })
  for (const source of sources) {
    const page = join(output, 'content/articles', `${source.slug}.md`)
    await mkdir(dirname(page), { recursive: true })
    await symlink(source.file, page)
  }

  await mkdir(join(output, 'static/posters'), { recursive: true })
  const site = JSON.parse(await read_file(join(app_dir, 'site.json'), 'utf8'))
  site.poster ??= 'example.svg'
  site.type = app.type
  site.selected_pages = pages.map(
    page => `/${page.path.replace(/index\.html$/, '')}`
  )
  await write_file(
    join(output, 'site.json'),
    `${JSON.stringify(site, null, 2)}\n`
  )

  for (const folder of ['static', 'partials']) {
    const overlay = join(app_dir, folder)
    if (exists_sync(overlay)) await copy_files(overlay, join(output, folder))
  }
  for (const asset of assets) {
    const target = join(output, 'static', asset.path)
    await mkdir(dirname(target), { recursive: true })
    await cp(asset.file, target)
  }
  const copied = new Set()
  for (const page of pages)
    for (const selection of [
      { file: page.file, path: page.path },
      { file: page.file, path: `${page.id.slice(1)}/index.html` },
      ...page.files
    ]) {
      if (copied.has(selection.path)) continue
      copied.add(selection.path)
      const target = join(output, 'static', selection.path)
      if (exists_sync(target))
        throw new Error(`route already used: ${selection.path}`)
      await mkdir(dirname(target), { recursive: true })
      await cp(selection.file, target)
    }

  const poster = join(output, 'static/posters', site.poster)
  const fallback = join(example, 'static/posters', site.poster)
  if (!exists_sync(poster) && exists_sync(fallback)) await cp(fallback, poster)
  if (exists_sync(join(app_dir, 'pages')))
    await copy_files(join(app_dir, 'pages'), join(output, 'pages'))
  await run(
    process.execPath,
    [join(example, 'build.js'), ...(drafts ? ['--drafts'] : [])],
    { cwd: output, maxBuffer: MAX }
  )

  const dist = join(output, 'dist')
  return {
    id: app.id,
    type: app.type,
    name,
    dist,
    sources: [
      ...sources.map(({ id, slug, route }) => ({ id, slug, route })),
      ...pages.map(({ id, path }) => ({
        id,
        route: `/${path.replace(/index\.html$/, '')}`
      }))
    ]
  }
}

export { app_assets } from './sources.js'
