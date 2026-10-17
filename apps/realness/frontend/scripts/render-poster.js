import fs from 'node:fs'
import path from 'node:path'
import { artifacts_dir } from './lib/artifacts.js'
import { run_entry } from './lib/entry.js'
import {
  launch_browser,
  make_profile,
  open_page,
  remove_profile,
  wait_for_driver
} from './lib/headless.js'

const DRIVER_ROUTE = '/poster-driver'
const READY_TIMEOUT_MS = 120000
const POLL_MS = 1000
const DEBUG_PORT = 9334
const LABEL = 'render-poster'
const IMAGE_TYPES = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.avif'
])

/**
 * Fail before any work when the image or browser is missing.
 * @param {string | undefined} input_path
 * @param {string | undefined} chrome_path
 */
export const preflight = (input_path, chrome_path) => {
  if (!input_path)
    throw new Error('usage: npm run poster <image-path | folder>')
  if (!chrome_path)
    throw new Error(
      'CHROME_PATH is not set - point it at a Chromium browser, the same one npm run score uses'
    )
  if (!fs.existsSync(chrome_path))
    throw new Error(`CHROME_PATH not found: ${chrome_path}`)
  if (!fs.existsSync(input_path))
    throw new Error(`image not found: ${input_path}`)
}

/**
 * The images to convert: the file itself, or a folder's images sorted by name.
 * @param {string} input_path
 * @returns {string[]}
 */
export const list_images = input_path => {
  if (!fs.statSync(input_path).isDirectory()) return [input_path]
  return fs
    .readdirSync(input_path, { withFileTypes: true })
    .filter(
      entry =>
        entry.isFile() &&
        IMAGE_TYPES.has(path.extname(entry.name).toLowerCase())
    )
    .map(entry => path.join(input_path, entry.name))
    .sort()
}

/** @param {string} input_path */
export const image_data_url = input_path =>
  `data:image/${path.extname(input_path).slice(1)};base64,${fs
    .readFileSync(input_path)
    .toString('base64')}`

/**
 * File stem for a poster itemid: dots become dashes, slashes underscores.
 * @param {string} itemid
 */
export const poster_stem = itemid =>
  itemid.replace(/\./g, '-').replace(/\//g, '_')

/**
 * Write the rendered SVG, and the PNG when the driver made one.
 * @param {string} out_dir
 * @param {{ itemid: string, svg: string, png?: string, viewbox?: string, width?: number, height?: number }} result
 * @param {string} [stem] file name without extension; defaults to the itemid stem
 */
export const write_poster = (
  out_dir,
  result,
  stem = poster_stem(result.itemid)
) => {
  fs.mkdirSync(out_dir, { recursive: true })
  const svg_file = path.join(out_dir, `${stem}.svg`)
  fs.writeFileSync(svg_file, result.svg)
  console.info(`${LABEL}: wrote ${svg_file}`)
  const files = [svg_file]
  if (result.png) {
    const png_file = path.join(out_dir, `${stem}.png`)
    fs.writeFileSync(png_file, Buffer.from(result.png.split(',')[1], 'base64'))
    console.info(
      `${LABEL}: wrote ${png_file}`,
      `(viewBox ${result.viewbox} ${result.width}x${result.height})`
    )
    files.push(png_file)
  }
  return files
}

/**
 * Render one image on an open driver page and check the result.
 * @param {(expression: string) => Promise<any>} evaluate
 * @param {string} image_path
 */
const render_image = async (evaluate, image_path) => {
  const image = image_data_url(image_path)
  let result
  try {
    result = await evaluate(
      `window.poster_driver.render(${JSON.stringify(image)}).then(r => r)`
    )
  } catch (error) {
    const debug = await evaluate(
      'window.poster_driver?.debug?.() ?? null'
    ).catch(() => null)
    console.error(
      `${LABEL}: render failed`,
      error.message,
      '| debug:',
      JSON.stringify(debug)
    )
    throw error
  }
  if (!result?.itemid || !result.svg)
    throw new Error('poster render returned nothing useful')
  return result
}

/**
 * Convert a folder's images in one browser, writing `<image>.svg` into out_dir.
 * A failed image is reported and skipped; the run fails after the rest finish.
 * @param {(expression: string) => Promise<any>} evaluate
 * @param {string[]} images
 * @param {string} out_dir
 */
const render_folder = async (evaluate, images, out_dir) => {
  const files = []
  const failed = []
  for (const [index, image_path] of images.entries()) {
    const name = path.basename(image_path)
    console.info(`${LABEL}: ${index + 1} / ${images.length} ${name}`)
    try {
      const result = await render_image(evaluate, image_path)
      const stem = path.basename(image_path, path.extname(image_path))
      files.push(...write_poster(out_dir, result, stem))
    } catch (error) {
      console.error(`${LABEL}: skipped ${name}:`, error.message)
      failed.push(name)
    }
  }
  if (failed.length)
    throw new Error(
      `${failed.length} of ${images.length} failed: ${failed.join(', ')}`
    )
  return files
}

/**
 * Turn an image, or every image in a folder, into posters on the live poster
 * driver page. A folder writes to `<folder>/posters` unless out_dir is given.
 * @param {object} [options]
 * @param {string} [options.input_path]
 * @param {string} [options.chrome_path]
 * @param {string} [options.origin]
 * @param {string} [options.out_dir]
 * @param {number} [options.poll_ms]
 * @param {number} [options.ready_timeout_ms]
 * @param {(options: { chrome_path: string, target_url: string, profile_dir: string }) => { kill: () => void }} [options.launch]
 * @param {() => Promise<{ send: (method: string) => Promise<unknown>, evaluate: (expression: string) => Promise<any> }>} [options.page]
 * @returns {Promise<string[]>} files written
 */
export const main = async ({
  input_path = process.argv[2],
  chrome_path = process.env.CHROME_PATH,
  origin = process.env.REALNESS_URL || 'https://realness.online',
  out_dir,
  poll_ms = POLL_MS,
  ready_timeout_ms = READY_TIMEOUT_MS,
  launch = options => launch_browser({ ...options, debug_port: DEBUG_PORT }),
  page = () => open_page(DEBUG_PORT, LABEL, { page_console: true })
} = {}) => {
  preflight(input_path, chrome_path)
  const folder = fs.statSync(input_path).isDirectory()
  const images = list_images(input_path)
  if (!images.length) throw new Error(`no images in ${input_path}`)
  const target_dir =
    out_dir ??
    (folder
      ? path.join(input_path, 'posters')
      : path.join(artifacts_dir, 'poster-driver'))
  const profile_dir = make_profile(LABEL)
  const target_url = `${origin}${DRIVER_ROUTE}`
  const browser = launch({ chrome_path, target_url, profile_dir })
  try {
    const { send, evaluate } = await page()
    await send('Log.enable').catch(() => {})
    console.info(`${LABEL}: loading ${target_url}`)
    await wait_for_driver(evaluate, { timeout_ms: ready_timeout_ms, poll_ms })

    if (folder) return await render_folder(evaluate, images, target_dir)
    return write_poster(target_dir, await render_image(evaluate, input_path))
  } finally {
    browser.kill()
    remove_profile(profile_dir, LABEL)
  }
}

await run_entry(import.meta.url, async () => {
  try {
    await main()
  } catch (error) {
    throw new Error(`${LABEL}: ${error.message}`)
  }
  process.exit(0)
})
