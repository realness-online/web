/**
 * Render a PNG preview for every print the shop lists, and upload it beside
 * the poster (`people/<author>/posters/<created>.png`) with a Firebase
 * download token, which is what the checkout function hands to Stripe.
 *
 * The shop lists the live `posters/` folder's plain `<created>.html`
 * files - the app's directory listing skips dashed (layer) filenames and
 * dedupes timestamps, so previews beside the posters are invisible to it.
 *
 * Builds dist first (`vp run build`), serves it locally, and drives the
 * poster driver through the devtools protocol - the same page the app's
 * export renderer runs on.
 *
 * Usage:
 *   npm run prints:previews -- [--limit N] [--force] [--no-upload]
 *
 * Env:
 *   CHROME_PATH      Chromium browser (defaults to Brave)
 *   PRINTS_AUTHOR    poster author id, e.g. /+16282281824 (defaults to
 *                    VITE_ADMIN_ID from .env.local)
 *   PRINTS_BUCKET    storage bucket (defaults to realness-online.appspot.com)
 */
import { execFileSync as exec_file_sync } from 'node:child_process'
import { randomUUID as random_uuid } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { artifacts_dir } from './lib/artifacts.js'
import { run_entry } from './lib/entry.js'
import {
  launch_browser,
  make_profile,
  open_page,
  remove_profile,
  serve_dist,
  wait_for_driver
} from './lib/headless.js'
import { frontend_out } from '#root/src/settings/output.js'

const DRIVER_ROUTE = '/poster-driver'
const SERVER_PORT = 4181
const DEBUG_PORT = 9335
const READY_TIMEOUT_MS = 120000
const POLL_MS = 1000
const LABEL = 'print-previews'
const BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'

/** @param {string[]} args */
export const parse_args = args => {
  const at = args.indexOf('--limit')
  return {
    limit: Number(at === -1 ? 0 : args[at + 1]),
    force: args.includes('--force'),
    upload: !args.includes('--no-upload')
  }
}

/**
 * The author whose posters are for sale: `PRINTS_AUTHOR`, else
 * `VITE_ADMIN_ID` from `.env.local` or `.env`.
 * @param {string | undefined} from_env
 * @param {string} project_root
 */
export const find_author = (from_env, project_root) => {
  let raw = from_env
  for (const name of ['.env.local', '.env']) {
    if (raw) break
    const file = path.join(project_root, name)
    if (!fs.existsSync(file)) continue
    const match = fs
      .readFileSync(file, 'utf8')
      .match(/^\s*VITE_ADMIN_ID\s*=\s*(.+?)\s*$/m)
    if (match) raw = match[1].replace(/^['"]|['"]$/g, '')
  }
  if (!raw)
    throw new Error(
      'no author: set PRINTS_AUTHOR or VITE_ADMIN_ID in .env.local'
    )
  return `/${raw.replace(/^\/+/, '')}`
}

/**
 * Run gcloud, failing with its error output.
 * @param {string[]} args
 */
export const gcloud = args => {
  try {
    return exec_file_sync('gcloud', args, { encoding: 'utf8' })
  } catch (error) {
    throw new Error(
      `gcloud failed (${args.join(' ')}): ${error.stderr?.trim() || error.message}`
    )
  }
}

/**
 * An object listing, empty when the prefix holds nothing.
 * @param {string} prefix
 */
export const storage_list = prefix => {
  try {
    return exec_file_sync('gcloud', ['storage', 'ls', prefix], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Created stamps of objects with this extension, newest first, no repeats.
 * @param {string[]} urls
 * @param {string} extension
 */
export const stamps = (urls, extension) =>
  [
    ...new Set(
      urls
        .map(url => path.posix.basename(url))
        .filter(name => new RegExp(`^\\d+\\.${extension}$`).test(name))
        .map(name => Number(name.split('.')[0]))
    )
  ].sort((a, b) => b - a)

/**
 * Upload a preview with a Firebase download token.
 * @param {string} destination
 * @param {string} file
 * @param {typeof gcloud} [run]
 */
export const upload_preview = (destination, file, run = gcloud) =>
  run([
    'storage',
    'cp',
    file,
    destination,
    '--content-type=image/png',
    `--custom-metadata=firebaseStorageDownloadTokens=${random_uuid()}`
  ])

/**
 * Write a preview PNG from its data URL.
 * @param {string} out_dir
 * @param {number} created
 * @param {string} data_url
 */
export const write_preview = (out_dir, created, data_url) => {
  fs.mkdirSync(out_dir, { recursive: true })
  const file = path.join(out_dir, `${created}.png`)
  fs.writeFileSync(file, Buffer.from(data_url.split(',')[1], 'base64'))
  return file
}

/**
 * Render and upload the previews the shop is missing.
 * @param {object} [options]
 * @param {string[]} [options.args]
 * @param {string} [options.dist_dir]
 * @param {string} [options.out_dir]
 * @param {string} [options.chrome_path]
 * @param {string} [options.bucket]
 * @param {() => string} [options.author]
 * @param {typeof storage_list} [options.list]
 * @param {(destination: string, file: string) => unknown} [options.put]
 * @param {number} [options.port]
 * @param {number} [options.poll_ms]
 * @param {number} [options.ready_timeout_ms]
 * @param {(options: { chrome_path: string, target_url: string, profile_dir: string }) => { kill: () => void }} [options.launch]
 * @param {() => Promise<{ evaluate: (expression: string) => Promise<any> }>} [options.page]
 * @returns {Promise<{ rendered: number[], failed: number[] }>}
 */
export const main = async ({
  args = process.argv.slice(2),
  dist_dir = frontend_out(),
  out_dir = path.join(artifacts_dir, 'print-previews'),
  chrome_path = process.env.CHROME_PATH ?? BRAVE,
  bucket = process.env.PRINTS_BUCKET ?? 'realness-online.appspot.com',
  author = () =>
    find_author(
      process.env.PRINTS_AUTHOR,
      path.join(import.meta.dirname, '..')
    ),
  list = storage_list,
  put = upload_preview,
  port = SERVER_PORT,
  poll_ms = POLL_MS,
  ready_timeout_ms = READY_TIMEOUT_MS,
  launch = options => launch_browser({ ...options, debug_port: DEBUG_PORT }),
  page = () => open_page(DEBUG_PORT, LABEL)
} = {}) => {
  const { limit, force, upload } = parse_args(args)
  if (!fs.existsSync(path.join(dist_dir, 'index.html')))
    throw new Error(
      'dist/index.html missing - npm run prints:previews builds first'
    )
  if (!fs.existsSync(chrome_path))
    throw new Error(`CHROME_PATH not found: ${chrome_path}`)
  const owner = author()
  const prefix = `gs://${bucket}/people${owner}/posters/`

  const listing = list(prefix)
  const prints = stamps(listing, 'html')
  if (!prints.length) throw new Error(`no prints found under ${prefix}`)
  const existing = new Set(upload ? stamps(listing, 'png') : [])
  const wanted = prints.filter(created => force || !existing.has(created))
  const batch = limit > 0 ? wanted.slice(0, limit) : wanted

  console.info(
    `${LABEL}: ${prints.length} prints, ${existing.size} previews, ` +
      `${batch.length} to render (author ${owner})`
  )
  if (!batch.length) {
    console.info(`${LABEL}: nothing to do; --force re-renders`)
    return { rendered: [], failed: [] }
  }

  const server = await serve_dist(dist_dir, port)
  const profile_dir = make_profile(LABEL)
  const target_url = `http://127.0.0.1:${server.address().port}${DRIVER_ROUTE}`
  const browser = launch({ chrome_path, target_url, profile_dir })

  const rendered = []
  const failed = []
  try {
    const { evaluate } = await page()
    await wait_for_driver(evaluate, { timeout_ms: ready_timeout_ms, poll_ms })
    for (const created of batch) {
      const itemid = `${owner}/posters/${created}`
      try {
        const result = await evaluate(
          `window.poster_driver.render_stored(${JSON.stringify(itemid)})`
        )
        if (!result?.png) throw new Error('render returned no png')
        const file = write_preview(out_dir, created, result.png)
        if (upload) put(`${prefix}${created}.png`, file)
        rendered.push(created)
        console.info(
          `${LABEL}: ${created} ${result.width}x${result.height}` +
            `${upload ? ' uploaded' : ' (no upload)'}`
        )
      } catch (error) {
        failed.push(created)
        console.error(`${LABEL}: ${created} failed - ${error.message}`)
      }
    }
  } finally {
    browser.kill()
    server.close()
    remove_profile(profile_dir, LABEL)
  }

  if (failed.length)
    throw new Error(`${failed.length} failed: ${failed.join(', ')}`)
  console.info(`${LABEL}: done, ${rendered.length} rendered`)
  return { rendered, failed }
}

await run_entry(import.meta.url, async () => {
  try {
    await main()
  } catch (error) {
    throw new Error(`${LABEL}: ${error.message}`)
  }
})
