#!/usr/bin/env node
import { readFileSync as read_file_sync } from 'node:fs'
import { join, dirname } from 'node:path'
import { execFileSync as exec_file_sync } from 'node:child_process'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { render_mermaid } from '../lib/mermaid-render.js'

const ROOT = join(dirname(file_url_to_path(import.meta.url)), '../../..')

/** Bash tools have no tty; walk up to pi's terminal and ask its size. The feed
 * pads each side and keeps a scrollbar column, so leave 4 spare. */
const pane_width = () => {
  const sh = (cmd, ...a) => exec_file_sync(cmd, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  try {
    for (let pid = process.pid; pid > 1; pid = Number(sh('ps', '-o', 'ppid=', '-p', String(pid)))) {
      const tty = sh('ps', '-o', 'tty=', '-p', String(pid))
      if (tty && tty !== '??') return Number(sh('stty', '-f', `/dev/${tty}`, 'size').split(' ')[1]) - 4
    }
  } catch {}
  return null
}

const args = process.argv.slice(2)
const maxAt = args.indexOf('--max')
const max = maxAt >= 0 ? Number(args.splice(maxAt, 2)[1]) : (pane_width() ?? 70)
const input = args[0] && args[0] !== '-' ? read_file_sync(args[0], 'utf8') : read_file_sync(0, 'utf8')
const fence = input.match(/```mermaid\n([\s\S]*?)```/)
const src = (fence ? fence[1] : input).trim()

const rendered = await render_mermaid(src)
if (!rendered) {
  console.error(`mermaid-fit: no installed Pi bundle under ${join(ROOT, '.pi/runtime')}`)
  process.exit(2)
}
const art = rendered.art
if (!art) {
  console.log('unparseable: pi shows the raw fence')
  process.exit(1)
}
const ok = art.width <= max && art.warnings.length === 0
console.log(
  `width ${art.width} / max ${max}${art.warnings.length ? ` warnings: ${art.warnings.join('; ')}` : ''} -> ${ok ? 'renders' : 'raw fence'}`
)
process.exit(ok ? 0 : 1)
