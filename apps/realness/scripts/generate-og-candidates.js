import fs from 'node:fs'
import path from 'node:path'
import { artifacts_dir } from './lib/artifacts.js'
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

const OG_ROUTE = '/og-candidates'
const READY_TIMEOUT_MS = 300000
const POLL_MS = 1000
const SERVER_PORT = 4179
const DEBUG_PORT = 9333
const MS_PER_SECOND = 1000

/**
 * Fail before any work when the build or browser is missing.
 * @param {string} dist_dir
 * @param {string | undefined} chrome_path
 */
export const preflight = (dist_dir, chrome_path) => {
  if (!fs.existsSync(path.join(dist_dir, 'index.html')))
    throw new Error(
      'dist/index.html missing - npm run og:candidates builds first'
    )
  if (!chrome_path)
    throw new Error(
      'CHROME_PATH is not set - point it at a Chromium browser, the same one npm run score uses'
    )
  if (!fs.existsSync(chrome_path))
    throw new Error(`CHROME_PATH not found: ${chrome_path}`)
}

const write_candidate = (out_dir, candidate, data_url) => {
  const base64 = data_url.slice(data_url.indexOf(',') + 1)
  fs.writeFileSync(
    path.join(out_dir, candidate.file),
    Buffer.from(base64, 'base64')
  )
}

/**
 * Render every landscape poster candidate and write them with a manifest.
 * @param {object} [options]
 * @param {string} [options.dist_dir]
 * @param {string} [options.out_dir]
 * @param {string} [options.chrome_path]
 * @param {number} [options.port]
 * @param {number} [options.poll_ms]
 * @param {number} [options.ready_timeout_ms]
 * @param {(options: { chrome_path: string, target_url: string, profile_dir: string }) => { kill: () => void }} [options.launch]
 * @param {() => Promise<{ evaluate: (expression: string) => Promise<any> }>} [options.page]
 */
export const main = async ({
  dist_dir = frontend_out(),
  out_dir = path.join(artifacts_dir, 'og-candidates'),
  chrome_path = process.env.CHROME_PATH,
  port = SERVER_PORT,
  poll_ms = POLL_MS,
  ready_timeout_ms = READY_TIMEOUT_MS,
  launch = options => launch_browser({ ...options, debug_port: DEBUG_PORT }),
  page = () => open_page(DEBUG_PORT, 'og-candidates')
} = {}) => {
  const started = Date.now()
  preflight(dist_dir, chrome_path)
  const server = await serve_dist(dist_dir, port)
  const profile_dir = make_profile('og-profile')
  const target_url = `http://127.0.0.1:${server.address().port}${OG_ROUTE}`
  const browser = launch({ chrome_path, target_url, profile_dir })

  const shutdown = () => {
    browser.kill()
    server.close()
    remove_profile(profile_dir, 'og-candidates')
  }

  try {
    const { evaluate } = await page()

    console.info(`og-candidates: rendering ${target_url}`)
    const deadline = Date.now() + ready_timeout_ms
    let done = false
    while (!done && Date.now() < deadline) {
      await sleep(poll_ms)
      done = await evaluate('window.__og_candidates_done === true')
      const status = await evaluate(
        'document.querySelector("#og-candidates header p")?.textContent ?? ""'
      )
      if (status) console.info(`og-candidates: ${status}`)
    }
    if (!done) throw new Error('page never finished rendering candidates')

    const candidates = await evaluate(
      'window.__og_candidates.map(({ itemid, style, file }) => ({ itemid, style, file }))'
    )
    if (!candidates?.length)
      throw new Error('no eligible landscape posters - nothing written')

    fs.rmSync(out_dir, { recursive: true, force: true })
    fs.mkdirSync(out_dir, { recursive: true })

    for (const [index, candidate] of candidates.entries()) {
      const data_url = await evaluate(
        `window.__og_candidates[${index}].data_url`
      )
      write_candidate(out_dir, candidate, data_url)
    }

    fs.writeFileSync(
      path.join(out_dir, 'manifest.json'),
      `${JSON.stringify({ generated_at: new Date().toISOString(), candidates }, null, 2)}\n`
    )

    console.info(
      `og-candidates: wrote ${candidates.length} files to ${path.relative(path.resolve(artifacts_dir, '../..'), out_dir)}`
    )
    console.info('og-candidates: pick one with npm run og:pick <file>')
    console.info(
      `og-candidates: done in ${Math.round((Date.now() - started) / MS_PER_SECOND)}s`
    )
    return candidates
  } finally {
    shutdown()
  }
}

await run_entry(import.meta.url, async () => {
  try {
    await main()
  } catch (error) {
    throw new Error(`og-candidates: ${error.message}`)
  }
  process.exit(0)
})
