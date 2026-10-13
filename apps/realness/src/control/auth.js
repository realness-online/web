import { execFile as exec_file } from "node:child_process"
import { promisify } from "node:util"
import { client, phone_of } from "#root/src/files/client.js"
import { keychain, login, token_source } from "#root/src/sign-on/node/login.js"
import { URLS } from "./status.js"
import { development_settings } from "#root/src/settings/environments.js"
import { not_admin_hint } from "./admins.js"

/** Sync answers 403 to a signed-in non-admin; say what to do about it. */
const check_admin = async (env, url, token) => {
  try {
    await client({ url, token }).ls("can://hosts/")
  } catch (error) {
    if (error.status === 403) throw new Error(not_admin_hint(env, phone_of(token)))
    throw error
  }
}

export const admin_login = async (env, {
  sign_on = process.env.SIGN_ON_URL ?? development_settings.public_url,
  url = URLS[env], store = keychain, sign_in = login,
  open = (address) => promisify(exec_file)("open", [address]),
} = {}) => {
  let credentials
  const signed = await sign_in({ sign_on, open, store: { write: async (value) => { credentials = value } } })
  await check_admin(env, url, signed.id_token)
  await store.write(credentials)
  return { admin: true, phone: phone_of(signed.id_token) }
}

export const admin_identity = async (env, { url = URLS[env], token = token_source() } = {}) => {
  const bearer = await token()
  if (!bearer) throw new Error("not signed in; run webspace <env> admin login")
  await check_admin(env, url, bearer)
  return { admin: true, phone: phone_of(bearer) }
}

export const admin_logout = async () => {
  await keychain.remove()
  return { signed_out: true }
}
