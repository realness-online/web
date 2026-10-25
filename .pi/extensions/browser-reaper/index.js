/**
 * Browser Reaper Extension
 *
 * Gives each pi process its own agent-browser session with a 10 minute idle
 * shutdown, and closes that session when pi exits, so no Chrome for Testing
 * outlives the agent that started it.
 */
/** @typedef {import("@earendil-works/pi-coding-agent").ExtensionAPI} ExtensionAPI */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(execFile)
export const IDLE_TIMEOUT_MS = '600000'
/**
 * @param {NodeJS.ProcessEnv} env
 * @param {number} pid
 * @returns {string}
 */
export const applyBrowserEnv = (env, pid) => {
  env.AGENT_BROWSER_IDLE_TIMEOUT_MS ??= IDLE_TIMEOUT_MS
  env.AGENT_BROWSER_SESSION ??= `pi-${pid}`
  return env.AGENT_BROWSER_SESSION
}
export default /** @param {ExtensionAPI} pi */ pi => {
  const session = applyBrowserEnv(process.env, process.pid)
  pi.on('session_shutdown', async () => {
    try {
      await run('agent-browser', ['--session', session, 'close'], { timeout: 15_000 })
    } catch {}
  })
}
