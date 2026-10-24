/**
 * web-md enforcement
 *
 * Fresh sessions kept reading pages with `curl | grep` or agent-browser even
 * with the AGENTS.md rule and the web-md skill loaded (7 of 8 runs). This
 * blocks those bash calls and tells the model the web-md command to run
 * instead. APIs, downloads, and local apps pass; `# web-md: skip` overrides.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { check } from './rules.js'

const web_md = resolve(dirname(fileURLToPath(import.meta.url)), '../../bin/web/web-md.js')

export default function (pi) {
  pi.on('tool_call', event => {
    if (event.toolName !== 'bash') return
    const reason = check(String(event.input?.command ?? ''), web_md)
    if (reason) return { block: true, reason }
  })
}
