import { local_settings } from '#root/src/settings/environments.js'
import { token_source, person_keychain } from '#root/src/sign-on/node/login.js'
import { disk } from '#root/src/can/disk.js'
import { sign_in_issuer } from '#root/src/sign-in/issuer.js'
import { local_person, local_person_file } from '#root/src/harness/settings.js'
import { project_root } from '#root/src/settings/layout.js'
import { join } from 'node:path'
import { SYNC_URL } from '#root/src/files/client.js'
import { HTTP } from '#root/lib/http.js'
import { MS_PER_SECOND } from '#root/lib/units.js'
import { out_path } from '#root/src/settings/output.js'

const PROBE_MS = 300
const REFRESH_MARGIN_S = 120
const LOCAL_TOKEN_S = 3600

export const local_sync_url = `http://127.0.0.1:${local_settings.sync_port}`

/**
 * Whether `npm run local` is up: its sync answers on this Mac.
 * Nothing is written to say so, so nothing goes stale when it stops.
 */
export const local_up = async (fetcher = fetch) => {
  try {
    const response = await fetcher(`${local_sync_url}/health`, {
      signal: AbortSignal.timeout(PROBE_MS)
    })
    return (
      response.status === HTTP.OK && (await response.text()).trim() === 'ok'
    )
  } catch {
    return false
  }
}

/**
 * Who the local stack belongs to: the checkout's person.local.html. Being on
 * this Mac is the sign-in, so there is no code and no keychain entry.
 */
export const local_owner = (root = join(project_root, '..', '..')) => {
  const phone = local_person(root)?.phone
  if (!phone)
    throw new Error(
      `no local owner: add ${local_person_file} with your telephone link`
    )
  return phone
}

/**
 * ID tokens for the local owner, signed with the local sign-in's own key.
 * Sync checks them exactly as it checks any token.
 * @param {{ phone?: string, storage?: { get: Function, put: Function }, project?: string }} [options]
 */
export const local_token_source = ({
  phone,
  storage = disk(out_path('sign-in')),
  project = local_settings.cloud.project
} = {}) => {
  /** @type {Awaited<ReturnType<typeof sign_in_issuer>> | undefined} */
  let issuer
  /** @type {string | null} */
  let cached = null
  let until = 0
  return async () => {
    if (cached && Date.now() < until) return cached
    issuer ??= await sign_in_issuer(storage, { project })
    cached = issuer.token(phone ?? local_owner())
    until = Date.now() + (LOCAL_TOKEN_S - REFRESH_MARGIN_S) * MS_PER_SECOND
    return cached
  }
}

/**
 * Where this Mac's sync commands go: the local stack when it is up,
 * otherwise the person's own sync with their saved sign-in.
 */
export const sync_target = async ({ fetcher = fetch } = {}) =>
  (await local_up(fetcher))
    ? {
        local: true,
        url: local_sync_url,
        get_token: local_token_source()
      }
    : person_target()

/** The person's own sync with their saved sign-in. */
export const person_target = async () => ({
  local: false,
  url: SYNC_URL,
  get_token: token_source({ store: person_keychain })
})
