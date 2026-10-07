import { execFile as exec_file } from "node:child_process"
import { promisify } from "node:util"
import { client, phone_of } from "#root/lib/files/src/client.js"
import { keychain, login, token_source } from "#root/lib/sign-on/src/node/login.js"
import { URLS } from "./status.js"

// Sync checks the admin list. Token claims alone do not grant operator access.
export const admin_login = async (env, {
  sign_on = process.env.SIGN_ON_URL ?? "https://realness-development.web.app",
  url = URLS[env], store = keychain, sign_in = login,
  open = (address) => promisify(exec_file)("open", [address]),
} = {}) => {
  let credentials
  const signed = await sign_in({ sign_on, open, store: { write: async (value) => { credentials = value } } })
  await client({ url, token: signed.id_token }).ls("can://hosts/")
  await store.write(credentials)
  return { admin: true, phone: phone_of(signed.id_token) }
}

export const admin_identity = async (env, { url = URLS[env], token = token_source() } = {}) => {
  const bearer = await token()
  if (!bearer) throw new Error("not signed in; run webspace <env> admin login")
  await client({ url, token: bearer }).ls("can://hosts/")
  return { admin: true, phone: phone_of(bearer) }
}

export const admin_logout = async () => {
  await keychain.remove()
  return { signed_out: true }
}
