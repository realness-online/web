import {
  existsSync as exists_sync,
  readdirSync as readdir_sync,
  readFileSync as read_file_sync,
  copyFileSync as copy_file_sync,
  appendFileSync as append_file_sync,
  rmSync as rm_sync
} from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'

const ROOT = join(dirname(file_url_to_path(import.meta.url)), '../../..')

/** Pi's bundle where Realness installs and runs it (`.pi/runtime`), else an older npm install. */
const chunks_dir = () => {
  const candidates = [
    join(ROOT, '.pi/runtime/node_modules/@earendil-works/pi-coding-agent/dist/bundle/chunks'),
    join(ROOT, '.pi/agent/npm/node_modules/@earendil-works/pi-coding-agent/dist/bundle/chunks')
  ]
  return candidates.find(dir => exists_sync(dir)) ?? null
}

/**
 * Render a mermaid source with the same engine pi's chat uses.
 * `{ art }` carries width, warnings, and plain rows; null when the engine is absent.
 */
export const render_mermaid = async src => {
  const chunks = chunks_dir()
  if (!chunks) return null
  const chunk = readdir_sync(chunks).find(
    f =>
      f.endsWith('.js') && read_file_sync(join(chunks, f), 'utf8').includes('function createMermaidMarkdownTransformer')
  )
  if (!chunk) return null
  const probe = join(chunks, `zz-mermaid-fit-${process.pid}.js`)
  copy_file_sync(join(chunks, chunk), probe)
  append_file_sync(probe, ';export {render as __mermaidFit};')
  try {
    const { __mermaidFit: render } = await import(probe)
    return { art: render(src) }
  } finally {
    rm_sync(probe, { force: true })
  }
}
