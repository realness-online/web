import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const server_entry = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../dist/server/entry-server.js'
)

console.info('loading', server_entry)
const mod = await import(pathToFileURL(server_entry).href)
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
