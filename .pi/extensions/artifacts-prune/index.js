/**
 * Artifacts Prune Extension
 *
 * Pruning happens at check-in: `.pi/bin/hooks/post-commit` runs
 * `.pi/bin/harness/artifacts-prune.js --apply` after each commit. Build outputs
 * live under `artifacts/` too, so nothing is deleted mid-session. Once a run
 * settles, this only says when `artifacts/` is over its cap, so the next commit
 * is expected to free space.
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
const findHarnessRoot = cwd => {
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

/**
 * What a dry run reports: items it would remove, their bytes, and a cap warning.
 * @param {string} stdout
 * @returns {{ items: number, bytes: number, warning: string | null }}
 */
export const read_report = stdout => {
  const counted = /prune (\d+) item\(s\), freed (\d+) bytes/.exec(stdout)
  return {
    items: counted ? Number(counted[1]) : 0,
    bytes: counted ? Number(counted[2]) : 0,
    warning: /^warning: (.+)$/m.exec(stdout)?.[1] ?? null
  }
}

export default /** @param {ExtensionAPI} pi */ pi => {
  let told = false
  pi.on('agent_settled', async (_event, ctx) => {
    if (told || !ctx.hasUI) return
    const root = findHarnessRoot(ctx.cwd)
    if (!root) return
    const script = join(root, '.pi/bin/harness/artifacts-prune.js')
    if (!existsSync(script)) return
    try {
      const { stdout } = await run(process.execPath, [script, '--quiet'], { cwd: root, timeout: 60_000 })
      const { items, bytes, warning } = read_report(stdout)
      if (!items && !warning) return
      told = true
      ctx.ui.notify(
        `${warning ?? 'artifacts/ is over its cap'}; the next commit prunes ${items} file(s), ${(bytes / 1_048_576).toFixed(1)} MiB`,
        'warning'
      )
    } catch {}
  })
}
