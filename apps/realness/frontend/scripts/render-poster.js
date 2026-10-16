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

/**
 * Fail before any work when the image or browser is missing.
 * @param {string | undefined} input_path
 * @param {string | undefined} chrome_path
 */
export const preflight = (input_path, chrome_path) => {
  if (!input_path) throw new Error('usage: npm run poster <image-path>')
  if (!chrome_path)
    throw new Error(
      'CHROME_PATH is not set - point it at a Chromium browser, the same one npm run score uses'
    )
  if (!fs.existsSync(chrome_path))
    throw new Error(`CHROME_PATH not found: ${chrome_path}`)
  if (!fs.existsSync(input_path))
    throw new Error(`image not found: ${input_path}`)
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
 */
export const write_poster = (out_dir, result) => {
  fs.mkdirSync(out_dir, { recursive: true })
  const stem = poster_stem(result.itemid)
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
 * Turn one image into a poster on the live poster driver page.
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
  out_dir = path.join(artifacts_dir, 'poster-driver'),
  poll_ms = POLL_MS,
  ready_timeout_ms = READY_TIMEOUT_MS,
  launch = options => launch_browser({ ...options, debug_port: DEBUG_PORT }),
  page = () => open_page(DEBUG_PORT, LABEL, { page_console: true })
} = {}) => {
  preflight(input_path, chrome_path)
  const image = image_data_url(input_path)
  const profile_dir = make_profile(LABEL)
  const target_url = `${origin}${DRIVER_ROUTE}`
  const browser = launch({ chrome_path, target_url, profile_dir })
  try {
    const { send, evaluate } = await page()
    await send('Log.enable').catch(() => {})
    console.info(`${LABEL}: loading ${target_url}`)
    await wait_for_driver(evaluate, { timeout_ms: ready_timeout_ms, poll_ms })

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
    return write_poster(out_dir, result)
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
