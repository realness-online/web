import { client } from '#root/src/files/client.js'
import { keychain_for, token_source } from '#root/src/sign-on/node/login.js'
import { read_status } from '#root/src/sync/halo-status.js'
import { local_token_source } from '#root/src/files/target.js'
import {
  environment_settings,
  local_settings
} from '#root/src/settings/environments.js'
import { MS_PER_SECOND } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- halos are read one at a time to keep the sync service quiet */

const SHOWN_DIGITS = 2

export const URLS = {
  local: `http://127.0.0.1:${local_settings.sync_port}`,
  development: environment_settings('development').services.sync_url,
  production: environment_settings('production').services.sync_url
}

/** Where an operator signs in for one environment; local uses development. */
export const SIGN_ON = {
  local: environment_settings('development').public_url,
  development: environment_settings('development').public_url,
  production: environment_settings('production').public_url
}

/** Tokens minted from the sign-in kept for this environment only; local signs in to the Mac's own sign-in. */
export const env_token = env =>
  env === 'local'
    ? local_token_source()
    : token_source({ store: keychain_for(env) })

const mask_phone = phone =>
  typeof phone === 'string' && /^\+[1-9]\d{6,14}$/.test(phone)
    ? `${phone.slice(0, 2)}***${phone.slice(-SHOWN_DIGITS)}`
    : phone

export const halo_status = async (
  env,
  name,
  { url = URLS[env], token = env_token(env), now = Date.now() } = {}
) => {
  if (!url) throw new Error(`no sync URL for ${env}`)
  const bearer = await token()
  if (!bearer) throw new Error('sign in to sync first')
  const sync = client({ url, token: bearer })
  const names = name
    ? [name]
    : (await sync.ls('can://halos/'))
        .filter(entry => entry.endsWith('/'))
        .map(entry => entry.slice(0, -1))
  const halos = []
  for (const halo_name of names) {
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(halo_name))
      throw new Error('invalid halo name')
    const record = read_status(
      (await sync.cat(`can://halos/${halo_name}/status.html`)).toString('utf8')
    )
    if (
      !record.halo ||
      record.halo.name !== halo_name ||
      !Number.isFinite(Date.parse(record.halo.checked))
    )
      throw new Error(`invalid status for ${halo_name}`)
    halos.push({
      ...record,
      actors: record.actors.map(actor => ({
        ...actor,
        owner: mask_phone(actor.owner)
      })),
      apps: record.apps.map(app => ({ ...app, owner: mask_phone(app.owner) })),
      age_s: Math.max(
        0,
        Math.floor((now - Date.parse(record.halo.checked)) / MS_PER_SECOND)
      )
    })
  }
  return halos
}

export const format_status = halos => {
  if (!halos.length) return 'halos: none'
  return halos
    .map(
      ({ halo, age_s, actors }) =>
        `${halo.name}: seed ${halo.seed}, ${halo.actors_running} running, ${actors.length} actors, last seen ${age_s}s ago`
    )
    .join('\n')
}
