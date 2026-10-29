/**
 * Any Realness PWA reloads with the network gone.
 *
 * Serve a built site, let the worker take control, open a route online,
 * stop the server, then reload and open the route again. Both must render.
 * The control repeats the run with the browser bypassing the worker; it has
 * to fail, or the check proves nothing.
 *
 *   node scripts/check-pwa-offline.js                       # the app
 *   node scripts/check-pwa-offline.js --dir <dist> --route /blog/x
 */
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs as parse_args } from 'node:util'
import { frontend_out } from '#root/src/settings/output.js'
import { run_entry } from './lib/entry.js'
import {
  launch_browser,
  make_profile,
  open_page,
  remove_profile,
  serve_dist,
  sleep
} from './lib/headless.js'

const LABEL = 'check-pwa-offline'
const BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
const DEBUG_PORT = 9341
const TIMEOUT_MS = 20000
const CONTROL_TIMEOUT_MS = 5000
const POLL_MS = 200

/** The app has rendered into its mount. */
const APP_READY = `Boolean(document.querySelector('main#realness')?.children.length)`
/** A page the site served, not the browser's offline page. */
const SITE_READY = `Boolean(document.querySelector('link[rel="manifest"]'))`

/**
 * @param {(expression: string) => Promise<unknown>} evaluate
 * @param {string} expression
 */
const wait_for = async (evaluate, expression, timeout = TIMEOUT_MS) => {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      if (await evaluate(expression)) return true
    } catch {}
    await sleep(POLL_MS)
  }
  return false
}

/** Set on a document before it is left; a fresh load never has it. */
const STALE = 'window.__offline_check_stale'

/**
 * A browser navigation, not one a page script can intercept, that must
 * land on a fresh document.
 * @param {{ send: Function, evaluate: (expression: string) => Promise<unknown> }} page
 * @param {string} url
 * @param {string} ready
 * @param {number} [timeout]
 */
const open_route = async (page, url, ready, timeout) => {
  await page.evaluate(`${STALE} = true`).catch(() => {})
  await page.send('Page.navigate', { url }).catch(() => {})
  return wait_for(
    page.evaluate,
    `!${STALE} && location.href === ${JSON.stringify(url)} && ${ready}`,
    timeout
  )
}

/**
 * One offline run. Returns the failures; empty means the site survived.
 * @param {{ dist_dir: string, chrome_path: string, route: string, ready: string, without_worker: boolean }} options
 * @returns {Promise<string[]>}
 */
export const offline_run = async ({
  dist_dir,
  chrome_path,
  route,
  ready,
  without_worker
}) => {
  const server = await serve_dist(dist_dir, 0)
  const origin = `http://127.0.0.1:${server.address().port}`
  const profile_dir = make_profile(LABEL)
  const browser = launch_browser({
    chrome_path,
    target_url: `${origin}/`,
    profile_dir,
    debug_port: DEBUG_PORT
  })
  const failures = []
  const offline_timeout = without_worker ? CONTROL_TIMEOUT_MS : TIMEOUT_MS
  try {
    const page = await open_page(DEBUG_PORT, LABEL)
    const { evaluate } = page
    if (!(await wait_for(evaluate, ready)))
      throw new Error('the site never rendered online')
    const controlled = await wait_for(
      evaluate,
      `navigator.serviceWorker.ready.then(() => Boolean(navigator.serviceWorker.controller))`
    )
    if (!controlled) throw new Error('no worker took control online')
    if (!(await open_route(page, `${origin}${route}`, ready)))
      throw new Error(`${route} never rendered online`)
    if (without_worker) {
      await page.send('Network.enable')
      await page.send('Network.setBypassServiceWorker', { bypass: true })
    }

    server.closeAllConnections()
    await new Promise(resolve => {
      server.close(resolve)
    })

    if (!(await open_route(page, `${origin}${route}`, ready, offline_timeout)))
      failures.push('reload offline did not render')
    if (!(await open_route(page, `${origin}/`, ready, offline_timeout)))
      failures.push('/ offline did not render')
    if (!(await open_route(page, `${origin}${route}`, ready, offline_timeout)))
      failures.push(`${route} offline did not render`)
  } finally {
    browser.kill()
    if (server.listening) server.close()
    remove_profile(profile_dir, LABEL)
  }
  return failures
}

/**
 * @param {object} [options]
 * @param {string[]} [options.args]
 * @param {string} [options.chrome_path]
 * @param {typeof offline_run} [options.run]
 */
export const main = async ({
  args = process.argv.slice(2),
  chrome_path = process.env.CHROME_PATH ?? BRAVE,
  run = offline_run
} = {}) => {
  const { values } = parse_args({
    args,
    options: {
      dir: { type: 'string' },
      route: { type: 'string' },
      ready: { type: 'string' }
    }
  })
  const app = !values.dir
  const dist_dir = values.dir ? path.resolve(values.dir) : frontend_out()
  const route = values.route ?? '/about'
  const ready = values.ready ?? (app ? APP_READY : SITE_READY)
  if (!fs.existsSync(path.join(dist_dir, 'service.worker.js')))
    throw new Error(`${LABEL}: no built worker in ${dist_dir}; build it first`)
  if (!fs.existsSync(chrome_path))
    throw new Error(`${LABEL}: CHROME_PATH not found: ${chrome_path}`)

  const options = { dist_dir, chrome_path, route, ready }
  const failures = await run({ ...options, without_worker: false })
  if (failures.length)
    throw new Error(`${LABEL}: offline failed - ${failures.join('; ')}`)
  const control = await run({ ...options, without_worker: true })
  if (!control.length)
    throw new Error(`${LABEL}: control passed with no worker; check is blind`)
  console.info(`${LABEL}: ${dist_dir} reloads, / and ${route} render offline`)
  console.info(
    `${LABEL}: control without a worker fails - ${control.join('; ')}`
  )
}

run_entry(import.meta.url, main)
