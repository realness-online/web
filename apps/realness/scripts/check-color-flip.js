/**
 * v4: a published page follows the system's light and dark flip on the
 * spot, diagrams included. No reload, no on-page switch.
 *
 *   node scripts/check-color-flip.js --dir <dist> --route <page with a diagram>
 */
import path from 'node:path'
import { parseArgs as parse_args } from 'node:util'
import { run_entry } from './lib/entry.js'
import {
  launch_browser,
  make_profile,
  open_page,
  remove_profile,
  serve_dist,
  sleep
} from './lib/headless.js'

const LABEL = 'check-color-flip'
const BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
const DEBUG_PORT = 9342
const TIMEOUT_MS = 20000
const POLL_MS = 200
const SETTLE_MS = 300

/**
 * The page surface, and the surface and text colors Pele resolves on a
 * diagram (--_bg, --_fg), which feed every part diagrams.css does not
 * override. Lines use --muted-text, the same gray in both modes by design.
 */
const READ = `(() => {
  const svg = document.querySelector('svg.pele, pre.mermaid svg, [data-diagram] svg')
  if (!svg || !svg.querySelector('g.pele-edges')) return null
  const css = getComputedStyle(svg)
  return {
    surface: getComputedStyle(document.body).backgroundColor,
    bg: css.getPropertyValue('--_bg').trim(),
    fg: css.getPropertyValue('--_fg').trim()
  }
})()`

/**
 * @param {{ send: Function, evaluate: Function }} page
 * @param {'light' | 'dark'} scheme
 */
const read_in = async (page, scheme) => {
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: scheme }]
  })
  await sleep(SETTLE_MS)
  return page.evaluate(READ)
}

/**
 * @param {{ dist_dir: string, route: string, chrome_path: string }} options
 * @returns {Promise<string[]>} problems
 */
export const flip_run = async ({ dist_dir, route, chrome_path }) => {
  const server = await serve_dist(dist_dir, 0)
  const profile_dir = make_profile(LABEL)
  const browser = launch_browser({
    chrome_path,
    target_url: `http://127.0.0.1:${server.address().port}${route}`,
    profile_dir,
    debug_port: DEBUG_PORT
  })
  const problems = []
  try {
    const page = await open_page(DEBUG_PORT, LABEL)
    const deadline = Date.now() + TIMEOUT_MS
    while (!(await page.evaluate(READ).catch(() => null))) {
      if (Date.now() > deadline) throw new Error(`no diagram drew on ${route}`)
      await sleep(POLL_MS)
    }
    const light = await read_in(page, 'light')
    const dark = await read_in(page, 'dark')
    const back = await read_in(page, 'light')
    if (light.surface === dark.surface)
      problems.push('the page surface did not flip')
    for (const part of ['bg', 'fg'])
      if (light[part] === dark[part])
        problems.push(`diagram --_${part} stayed ${light[part]} in both modes`)
    if (back.bg !== light.bg || back.fg !== light.fg)
      problems.push('flipping back did not restore the diagram')
  } finally {
    browser.kill()
    server.close()
    remove_profile(profile_dir, LABEL)
  }
  return problems
}

/**
 * @param {{ args?: string[], chrome_path?: string, run?: typeof flip_run }} [options]
 */
export const main = async ({
  args = process.argv.slice(2),
  chrome_path = process.env.CHROME_PATH ?? BRAVE,
  run = flip_run
} = {}) => {
  const { values } = parse_args({
    args,
    options: { dir: { type: 'string' }, route: { type: 'string' } }
  })
  if (!values.dir || !values.route)
    throw new Error(`${LABEL}: --dir and --route are required`)
  const problems = await run({
    dist_dir: path.resolve(values.dir),
    route: values.route,
    chrome_path
  })
  for (const problem of problems) console.error(`${LABEL}: ${problem}`)
  if (problems.length)
    throw new Error(`${LABEL}: ${problems.length} problem(s)`)
  console.info(`${LABEL}: page and diagrams follow light and dark on the spot`)
}

run_entry(import.meta.url, main)
