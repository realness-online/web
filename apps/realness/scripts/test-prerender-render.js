import { pathToFileURL as path_to_file_url } from 'node:url'
import { frontend_out } from '#root/src/settings/output.js'
import { run_entry } from './lib/entry.js'

/**
 * Load the built server entry and render a couple of routes, to smoke-test prerender.
 * @param {object} [options]
 * @param {string} [options.server_entry]
 * @param {string[]} [options.routes]
 * @param {(url: string) => Promise<{ render: (route: string) => Promise<string> }>} [options.load]
 * @returns {Promise<Record<string, number>>} bytes per route
 */
export const main = async ({
  server_entry = frontend_out('server', 'entry-server.js'),
  routes = ['/docs', '/about'],
  load = url => import(url)
} = {}) => {
  console.info('loading', server_entry)
  const mod = await load(path_to_file_url(server_entry).href)
  console.info('loaded', Object.keys(mod))
  const sizes = {}
  await Promise.all(
    routes.map(async route => {
      console.info('render', route)
      const html = await mod.render(route)
      sizes[route] = html.length
      console.info(route, html.length, 'bytes')
    })
  )
  return sizes
}

await run_entry(import.meta.url, main)
