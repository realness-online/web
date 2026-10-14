import { client } from '#root/src/files/client.js'
import { token_source } from '#root/src/sign-on/node/login.js'
import { read_status } from '#root/src/sync/host-status.js'
import { development_settings } from '#root/src/settings/environments.js'
import { MS_PER_SECOND } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- hosts are read one at a time to keep the sync service quiet */

const SHOWN_DIGITS = 2

export const URLS = {
  local: development_settings.services.sync_url,
  development: development_settings.services.sync_url
}

const mask_phone = phone =>
  typeof phone === 'string' && /^\+[1-9]\d{6,14}$/.test(phone)
    ? `${phone.slice(0, 2)}***${phone.slice(-SHOWN_DIGITS)}`
    : phone

export const host_status = async (
  env,
  name,
  { url = URLS[env], token = token_source(), now = Date.now() } = {}
) => {
  if (!url) throw new Error(`no sync URL for ${env}`)
  const bearer = await token()
  if (!bearer) throw new Error('sign in to sync first')
  const sync = client({ url, token: bearer })
  const names = name
    ? [name]
    : (await sync.ls('can://hosts/'))
        .filter(entry => entry.endsWith('/'))
        .map(entry => entry.slice(0, -1))
  const hosts = []
  for (const host_name of names) {
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(host_name))
      throw new Error('invalid host name')
    const record = read_status(
      (await sync.cat(`can://hosts/${host_name}/status.html`)).toString('utf8')
    )
    if (
      !record.host ||
      record.host.name !== host_name ||
      !Number.isFinite(Date.parse(record.host.checked))
    )
      throw new Error(`invalid status for ${host_name}`)
    hosts.push({
      ...record,
      actors: record.actors.map(actor => ({
        ...actor,
        owner: mask_phone(actor.owner)
      })),
      apps: record.apps.map(app => ({ ...app, owner: mask_phone(app.owner) })),
      age_s: Math.max(
        0,
        Math.floor((now - Date.parse(record.host.checked)) / MS_PER_SECOND)
      )
    })
  }
  return hosts
}

export const format_status = hosts => {
  if (!hosts.length) return 'hosts: none'
  return hosts
    .map(
      ({ host, age_s, actors }) =>
        `${host.name}: seed ${host.seed}, ${host.actors_running} running, ${actors.length} actors, last seen ${age_s}s ago`
    )
    .join('\n')
}
