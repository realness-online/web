import { dirname } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { build_site } from './src/build.js'
import { watch_sources } from './src/watch.js'

const engine = dirname(file_url_to_path(import.meta.url))
const options = {
  drafts: process.argv.includes('--drafts'),
  watch: process.argv.includes('--watch')
}
const build = () => build_site(engine, options)

await build()
if (options.watch) watch_sources(build)
