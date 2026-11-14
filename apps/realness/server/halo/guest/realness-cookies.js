/**
 * A site's saved login, as the door hands it to the owner's own box.
 *
 * The jar stays on the halo. The box asks for the cookies, loads them into its
 * own Chrome, and gives them back when it is done, so a login survives across
 * runs without the halo running a Chrome at all.
 */
const REPLY_MS = 30_000

/**
 * One site's cookies, or a failure that names the site.
 * @param {string} site
 * @param {(request: Record<string, unknown>, options?: { timeout_ms?: number }) => Promise<Record<string, any>>} ask
 * @returns {Promise<{ name: string, value: string, domain: string, path: string, expires: number, httpOnly: boolean, secure: boolean }[]>}
 */
export const login_of = async (site, ask) => {
  const reply = await ask(
    { op: 'site-cookies', site },
    { timeout_ms: REPLY_MS }
  )
  if (!reply.ok)
    throw new Error(reply.error ?? `no reply from the halo for ${site}`)
  return reply.cookies ?? []
}

/**
 * Give a site's cookies back, so the next read starts where this one ended.
 * @param {string} site
 * @param {{ name: string, value: string }[]} cookies
 * @param {(request: Record<string, unknown>, options?: { timeout_ms?: number }) => Promise<Record<string, any>>} ask
 */
export const save_login = async (site, cookies, ask) => {
  const reply = await ask(
    { op: 'site-cookies', site, save: cookies },
    { timeout_ms: REPLY_MS }
  )
  if (!reply.ok)
    throw new Error(reply.error ?? `no reply from the halo for ${site}`)
  return reply.saved ?? 0
}
