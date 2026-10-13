import {
  fileURLToPath as file_url_to_path,
  pathToFileURL as path_to_file_url
} from 'node:url'
import path from 'node:path'

const server_entry = path.join(
  path.dirname(file_url_to_path(import.meta.url)),
  '../dist/server/entry-server.js'
)

console.info('loading', server_entry)
const mod = await import(path_to_file_url(server_entry).href)
console.info('loaded', Object.keys(mod))
process.on('unhandledRejection', err => {
  console.error('unhandledRejection', err)
  process.exit(1)
})

await Promise.all(
  ['/docs', '/about'].map(async route => {
    console.info('render', route)
    const html = await mod.render(route)
    console.info(route, html.length, 'bytes')
  })
)
