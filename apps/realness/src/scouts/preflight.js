import { execFile as exec_file_callback } from 'node:child_process'
import { promisify } from 'node:util'
import { GIB } from '#root/lib/units.js'

const exec_file = promisify(exec_file_callback)

/** Free space a run needs: a page's HTML, a log, and the finds it writes. */
export const FREE_BYTES = 2 * GIB

/**
 * The gate a scout run clears on the halo before any loop starts: free space
 * on the actors volume. The Chrome a run renders with lives in its own box.
 * @param {{ store: { free_bytes: () => number } }} halo
 * @returns {{ free: number }}
 */
export const scout_preflight = ({ store }) => {
  const free = store.free_bytes()
  if (free < FREE_BYTES)
    throw new Error(
      `the actors volume has ${Math.floor(free / GIB)} GiB free; a run needs ${FREE_BYTES / GIB}`
    )
  return { free }
}

/**
 * The gate a box clears before any pi starts: the halo issues this box a model
 * pass. A Mac has no `realness-model-pass` and passes.
 * @param {(command: string) => Promise<{ stdout: string }>} [run]
 * @returns {Promise<'box' | 'mac'>}
 */
export const box_ready = async (run = command => exec_file(command)) => {
  const reply = await run('realness-model-pass').catch(error => {
    if (error.code === 'ENOENT') return null
    throw new Error(
      `the halo issued no model pass: ${(error.stderr || error.message).trim()}`
    )
  })
  if (!reply) return 'mac'
  if (!reply.stdout.trim())
    throw new Error('the halo issued an empty model pass')
  return 'box'
}
