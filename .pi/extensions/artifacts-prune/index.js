/**
 * Artifacts Prune Extension
 *
 * Runs `.pi/bin/harness/artifacts-prune.js --apply` once a run settles, so scratch under
 * `artifacts/` stays under 500 MB, oldest files first.
 */
/** @typedef {import("@earendil-works/pi-coding-agent").ExtensionAPI} ExtensionAPI */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
const run = promisify(execFile)
/**
 * @param {string} cwd
 * @returns {string | null}
 */
const findHarnessRoot = (cwd) => {
  let dir = resolve(cwd)
  while (true) {
    if (existsSync(join(dir, '.pi', 'bin')) && existsSync(join(dir, 'work'))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}
export default /** @param {ExtensionAPI} pi */ (pi) => {
  pi.on('agent_settled', async (_event, ctx) => {
    const root = findHarnessRoot(ctx.cwd)
    if (!root) return
    const script = join(root, '.pi/bin/harness/artifacts-prune.js')
    if (!existsSync(script)) return
    try {
      const { stdout } = await run(process.execPath, [script, '--apply', '--quiet'], {
        cwd: root,
        timeout: 60_000,
      })
      const warning = /^warning: (.+)$/m.exec(stdout)
      if (warning) ctx.ui.notify(warning[1], 'warning')
      const match = /freed (\d+) bytes/.exec(stdout)
      const freed = match ? Number(match[1]) : 0
      if (freed > 0) {
        ctx.ui.notify(`artifacts prune: freed ${(freed / 1_048_576).toFixed(1)} MiB`, 'info')
      }
    } catch {}
  })
}
