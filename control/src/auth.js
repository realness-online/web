import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { client, phone_of } from "../../sync/src/client.js"
import { keychain, login, token_source } from "../../sync/src/login.js"
import { URLS } from "./status.js"

// Sync checks the admin list. Token claims alone do not grant operator access.
export async function admin_login(env, {
  sign_on = process.env.SIGN_ON_URL ?? "https://brayness-sign-on.web.app",
  url = URLS[env], store = keychain, sign_in = login,
  open = (address) => promisify(execFile)("open", [address]),
} = {}) {
  let credentials
  const signed = await sign_in({ sign_on, open, store: { write: async (value) => { credentials = value } } })
  await client({ url, token: signed.id_token }).ls("can://hosts/")
  await store.write(credentials)
  return { admin: true, phone: phone_of(signed.id_token) }
}

export async function admin_identity(env, { url = URLS[env], token = token_source() } = {}) {
  const bearer = await token()
  if (!bearer) throw new Error("not signed in; run webspace <env> admin login")
  await client({ url, token: bearer }).ls("can://hosts/")
  return { admin: true, phone: phone_of(bearer) }
}

export async function admin_logout() {
  await keychain.remove()
  return { signed_out: true }
}
