/**
 * realness-read enforcement
 *
 * Fresh sessions kept reading pages with `curl | grep` or agent-browser even
 * with the AGENTS.md rule and the realness-read skill loaded (7 of 8 runs). This
 * blocks those bash calls and tells the model the realness-read command to run
 * instead. APIs, downloads, and local apps pass; `# realness-read: skip` overrides.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { check } from './rules.js'

const read_command = resolve(dirname(fileURLToPath(import.meta.url)), '../../bin/web/realness-read')

export default function (pi) {
  pi.on('tool_call', event => {
    if (event.toolName !== 'bash') return
    const reason = check(String(event.input?.command ?? ''), read_command)
    if (reason) return { block: true, reason }
  })
}
