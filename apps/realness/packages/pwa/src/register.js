/**
 * The kit in the browser: register the worker, then follow the update rule.
 * A page that does long work passes is_working so updates wait for it.
 *
 * A document site passes warm: the page that installed the worker and the
 * start page were fetched before it existed, so put them in the page cache.
 */
import { PAGES_CACHE } from './profiles.js'
import { watch_for_updates } from './watch-for-updates.js'

/**
 * @param {Window} win
 * @param {ServiceWorkerContainer} workers
 * @param {string} start
 */
const warm_pages = async (win, workers, start) => {
  await workers.ready
  const pages = await win.caches.open(PAGES_CACHE)
  const paths = [...new Set([win.location.pathname, start])]
  await Promise.all(
    paths.map(async path => {
      if (!(await pages.match(path))) await pages.add(path)
    })
  )
}

/**
 * @param {object} [options]
 * @param {string} [options.url] the worker
 * @param {() => boolean} [options.is_working]
 * @param {Navigator} [options.nav]
 * @param {Window} [options.win]
 * @param {boolean} [options.warm] cache the current and start pages
 * @param {string} [options.start] the start page
 * @returns {Promise<(() => void) | undefined>} stops watching
 */
export const register_pwa = async ({
  url = '/service.worker.js',
  is_working = () => false,
  nav = navigator,
  win = window,
  warm = false,
  start = '/'
} = {}) => {
  const workers = nav.serviceWorker
  if (!workers) return undefined
  await workers.register(url)
  if (warm && win.caches) await warm_pages(win, workers, start).catch(() => {})
  return watch_for_updates({
    workers,
    doc: win.document,
    is_working,
    reload: () => win.location.reload()
  })
}
