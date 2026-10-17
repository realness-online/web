import { execFile as exec_file } from 'node:child_process'
import { promisify } from 'node:util'
import { client, phone_of } from '#root/src/files/client.js'
import { keychain_for, login } from '#root/src/sign-on/node/login.js'
import { env_token, SIGN_ON, URLS } from './status.js'
import { not_admin_hint } from './admins.js'
import { HTTP } from '#root/lib/http.js'

/**
 * Sync answers 403 to a signed-in non-admin; say what to do about it. A sync
 * with no halos yet answers 404, which is not a refusal.
 */
const check_admin = async (env, url, token) => {
  try {
    await client({ url, token }).ls('can://halos/')
  } catch (error) {
    if (error.status === HTTP.FORBIDDEN)
      throw new Error(not_admin_hint(env, phone_of(token)))
    if (error.status === HTTP.NOT_FOUND) return
    throw error
  }
}

export const admin_login = async (
  env,
  {
    sign_on = SIGN_ON[env],
    url = URLS[env],
    store = keychain_for(env),
    sign_in = login,
    open = address => promisify(exec_file)('open', [address])
  } = {}
) => {
  let credentials
  const signed = await sign_in({
    sign_on,
    open,
    store: {
      /** @returns {Promise<never>} */
      read: () =>
        Promise.reject(new Error('admin login keeps no readable credentials')),
      /** @returns {Promise<void>} */
      write: value => {
        credentials = value
        return Promise.resolve()
      },
      /** @returns {Promise<void>} */
      remove: () => Promise.resolve()
    }
  })
  await check_admin(env, url, signed.id_token)
  await store.write(credentials)
  return { admin: true, phone: phone_of(signed.id_token) }
}

export const admin_identity = async (
  env,
  { url = URLS[env], token = env_token(env) } = {}
) => {
  const bearer = await token()
  if (!bearer) throw new Error('not signed in; run realness <env> admin login')
  await check_admin(env, url, bearer)
  return { admin: true, phone: phone_of(bearer) }
}

export const admin_logout = async env => {
  await keychain_for(env).remove()
  return { signed_out: true }
}
