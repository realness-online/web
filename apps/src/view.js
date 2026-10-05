/**
 * Render one app with the static example.
 *
 * The example is the renderer: Markdown to semantic HTML, microdata, posters,
 * diagrams, sitemap. It is fetched once into `artifacts/apps-engine` and never
 * edited. An app owns only its choices (app.json), its site values
 * (site.json), its own static overlay, and, for plans, the covers.
 *
 * The build tree is `artifacts/apps/<name>/`: article files are links to the
 * vault, so no original is ever copied. `dist/` there is publishable.
 */
import { execFile as exec_file } from 'node:child_process'
import { existsSync as exists_sync } from 'node:fs'
import { cp, mkdir, readFile as read_file, readdir, rm, symlink, writeFile as write_file } from 'node:fs/promises'
import { dirname, isAbsolute as is_absolute, join } from 'node:path'
import { promisify } from 'node:util'
import { app_sources } from './sources.js'

const run = promisify(exec_file)
const EXAMPLE = 'gh:scott-fryxell/brayness-examples/static'
const MAX = 10 << 20

/**
 * The reference renderer, installed once and reused by every app.
 * @param {string} root Harness root.
 * @param {string} [local] A local renderer checkout; otherwise fetched once.
 * @returns {Promise<string>} Renderer directory.
 */
export const engine = async (root, local = process.env.APPS_EXAMPLE) => {
  const directory = local ? (is_absolute(local) ? local : join(root, local)) : join(root, 'artifacts/apps-engine')
  if (!local && !exists_sync(join(directory, 'build.js'))) await run('npx', ['-y', 'giget', EXAMPLE, directory], { cwd: root, maxBuffer: MAX })
  if (!exists_sync(join(directory, 'src/build.js')) || !exists_sync(join(directory, 'static/plans.css')))
    throw new Error(`outdated renderer: ${directory}; set APPS_EXAMPLE to the updated static example`)
  const { dependencies = {} } = JSON.parse(await read_file(join(directory, 'package.json'), 'utf8'))
  const installed = Object.keys(dependencies).every((name) => exists_sync(join(directory, 'node_modules', name, 'package.json')))
  if (!installed) await run('npm', ['install', '--no-fund', '--no-audit'], { cwd: directory, maxBuffer: MAX })
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
 * App overlays never modify the renderer source: the example's static/ and
 * partials/ sit underneath the app's, so an app adds files instead of
 * restating the theme. Explicitly selected assets copy last and override.
 *
 * @param {string} root Harness root.
 * @param {string} name App name.
 * @param {{drafts?: boolean, example?: string}} [options]
 */
export const build_app = async (root, name, { drafts = false, example: local } = {}) => {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`bad app name: ${name}`)
  const app_dir = join(root, 'apps', name)
  const { app, sources, assets } = await app_sources(app_dir)
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
  await write_file(join(output, 'site.json'), `${JSON.stringify(site, null, 2)}\n`)

  for (const folder of ['static', 'partials']) {
    await copy_files(join(example, folder), join(output, folder))
    const overlay = join(app_dir, folder)
    if (exists_sync(overlay)) await copy_files(overlay, join(output, folder))
  }
  for (const asset of assets) {
    const target = join(output, 'static', asset.path)
    await mkdir(dirname(target), { recursive: true })
    await cp(asset.file, target)
  }
  if (exists_sync(join(app_dir, 'pages'))) await copy_files(join(app_dir, 'pages'), join(output, 'pages'))
  await run(process.execPath, [join(example, 'build.js'), ...(drafts ? ['--drafts'] : [])], { cwd: output, maxBuffer: MAX })

  const dist = join(output, 'dist')
  return { id: app.id, type: app.type, name, dist, sources: sources.map(({ id, slug, route }) => ({ id, slug, route })) }
}

export { app_assets } from './sources.js'
