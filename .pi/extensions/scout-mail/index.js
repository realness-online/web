/**
 * Scout mail: when a session opens on the Mac, mail any scout run that has not
 * gone out yet. Scouts run in the halo, which is Linux and has no Apple Mail,
 * so the digest is sent from here, reading the shared vault.
 */
import { execFile } from 'node:child_process'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** The digest sender, in the app that owns the scouts. */
export const DIGEST = file_url_to_path(new URL('../../../apps/realness/scripts/mail-digest.js', import.meta.url))

/** Mail waits on a person, so give up rather than hold the session open. */
const TIMEOUT_MS = 120_000

/**
 * Send what the scouts owe. Only a Mac has Apple Mail, and only a real session
 * has a person behind it.
 * @param {object} [options]
 * @param {string} [options.platform]
 * @param {(file: string, args: string[]) => Promise<unknown>} [options.exec]
 * @returns {Promise<number>} how many runs went out
 */
export const send_owed = async ({
  platform = process.platform,
  exec = (file, args) => run(file, args, { timeout: TIMEOUT_MS })
} = {}) => {
  if (platform !== 'darwin') return 0
  const { stdout } = await exec(process.execPath, [DIGEST, '--send'])
  return Number(/mailed (\d+)/.exec(stdout ?? '')?.[1] ?? 0)
}

/**
 * @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi
 * @param {{ send?: () => Promise<number> }} [options] the sender, for a test
 */
export default function (pi, { send = send_owed } = {}) {
  pi.on('session_start', async (_event, ctx) => {
    const mailed = await send().catch(error => {
      ctx.ui.notify(`scout mail: ${error.message}`, 'info')
      return 0
    })
    if (mailed) ctx.ui.notify(`scout mail: mailed ${mailed}`, 'info')
  })
}
