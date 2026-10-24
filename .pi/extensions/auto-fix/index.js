/**
 * Auto-fix Extension
 *
 * Collects every file an `edit` or `write` touches during an agent run and,
 * once the run ends, fixes them with the project's own tools through
 * `bin/harness/auto-fix.js`. Configuration lives in that file, inside the repo.
 */
/** @typedef {import("@earendil-works/pi-coding-agent").ExtensionAPI} ExtensionAPI */
import { isAbsolute, relative, resolve } from 'node:path'
import { fix } from '../../../bin/harness/auto-fix.js'

/**
 * Absolute path of a tool's file when it sits inside the working folder.
 * @param {string | undefined} path
 * @param {string} cwd
 * @returns {string | null}
 */
export const inside = (path, cwd) => {
  if (!path) return null
  const absolute = isAbsolute(path) ? path : resolve(cwd, path)
  return relative(cwd, absolute).startsWith('..') ? null : absolute
}

/** @param {ExtensionAPI} pi */
export default function auto_fix(pi) {
  if (process.env.PI_AUTO_FIX === '0') return
  const pending = new Set()

  pi.on('agent_start', () => pending.clear())

  pi.on('tool_result', async (event, ctx) => {
    if (event.isError || (event.toolName !== 'edit' && event.toolName !== 'write')) return
    const path = inside(event.input?.path, ctx.cwd)
    if (path) pending.add(path)
  })

  pi.on('agent_end', async (_event, ctx) => {
    if (!pending.size) return
    const files = [...pending]
    pending.clear()
    const { total, changed, failed } = await fix(files)
    if (!changed.length && !failed.length) return
    const note = `[auto-fix] ${changed.length}/${total} updated${failed.length ? `; failed: ${failed.join(', ')}` : ''}`
    ctx.ui.notify(note, failed.length ? 'warning' : 'info')
  })
}
