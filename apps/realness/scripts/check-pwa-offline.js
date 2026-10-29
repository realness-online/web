/**
 * pw4: the built app reloads with the network gone.
 *
 * Serve the build, let the worker take control, stop the server, then reload
 * and open a route. Both must render. The control repeats the run with the
 * worker removed first; it has to fail, or the check proves nothing.
 */
import fs from 'node:fs'
import path from 'node:path'
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
const ROUTE = '/about'

const RENDERED = `Boolean(document.querySelector('main#realness')?.children.length)`

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

/**
 * One offline run. Returns the failures; empty means the page survived.
 * @param {{ dist_dir: string, chrome_path: string, without_worker: boolean }} options
 * @returns {Promise<string[]>}
 */
export const offline_run = async ({
  dist_dir,
  chrome_path,
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
    const { evaluate } = await open_page(DEBUG_PORT, LABEL)
    if (!(await wait_for(evaluate, RENDERED)))
      throw new Error('the app never rendered online')
    const controlled = await wait_for(
      evaluate,
      `navigator.serviceWorker.ready.then(() => Boolean(navigator.serviceWorker.controller))`
    )
    if (!controlled) throw new Error('no worker took control online')
    if (without_worker)
      await evaluate(
        `navigator.serviceWorker.getRegistrations().then(all => Promise.all(all.map(r => r.unregister())))`
      )

    server.closeAllConnections()
    await new Promise(resolve => {
      server.close(resolve)
    })

    await evaluate(`location.reload()`).catch(() => {})
    if (!(await wait_for(evaluate, RENDERED, offline_timeout)))
      failures.push('reload offline did not render')
    await evaluate(`location.assign(${JSON.stringify(ROUTE)})`).catch(() => {})
    const routed = await wait_for(
      evaluate,
      `location.pathname === ${JSON.stringify(ROUTE)} && ${RENDERED}`,
      offline_timeout
    )
    if (!routed) failures.push(`${ROUTE} offline did not render`)
  } finally {
    browser.kill()
    if (server.listening) server.close()
    remove_profile(profile_dir, LABEL)
  }
  return failures
}

/**
 * @param {{ dist_dir?: string, chrome_path?: string, run?: typeof offline_run }} [options]
 */
export const main = async ({
  dist_dir = frontend_out(),
  chrome_path = process.env.CHROME_PATH ?? BRAVE,
  run = offline_run
} = {}) => {
  if (!fs.existsSync(path.join(dist_dir, 'service.worker.js')))
    throw new Error(`${LABEL}: no built worker in ${dist_dir}; npm run build`)
  if (!fs.existsSync(chrome_path))
    throw new Error(`${LABEL}: CHROME_PATH not found: ${chrome_path}`)

  const failures = await run({ dist_dir, chrome_path, without_worker: false })
  if (failures.length)
    throw new Error(`${LABEL}: offline failed - ${failures.join('; ')}`)
  const control = await run({ dist_dir, chrome_path, without_worker: true })
  if (!control.length)
    throw new Error(`${LABEL}: control passed with no worker; check is blind`)
  console.info(`${LABEL}: reload and ${ROUTE} render offline`)
  console.info(
    `${LABEL}: control without a worker fails - ${control.join('; ')}`
  )
}

run_entry(import.meta.url, main)
