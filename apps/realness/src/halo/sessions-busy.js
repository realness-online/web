import * as vsock from './vsock.js'

const PTY = '/usr/local/bin/realness-pty'
const ASK_SECONDS = 5

/**
 * The actor's named terminal sessions that run a foreground job (a build, a
 * server, a watch). The sweep keeps such an actor awake. Any failure to ask
 * reads as none: a guest that cannot answer is not doing work for anyone.
 * @param {{ vsock_path?: string }} record
 * @param {number} [port]
 * @returns {Promise<string[]>}
 */
export const sessions_busy = async (record, port = vsock.VSOCK_PORT) => {
  if (!record.vsock_path) return []
  try {
    const { code, out } = await vsock.exec_in_guest(
      record.vsock_path,
      [PTY, 'busy'],
      { timeout: ASK_SECONDS, port }
    )
    if (code !== 0) return []
    return out.toString().split('\n').filter(Boolean)
  } catch {
    return []
  }
}
