/** Actor turns use the same sync client, with a fresh VM-bound pass. */
import { readFile as read_file } from 'node:fs/promises'
import { join } from 'node:path'
import { client } from '#root/src/files/client.js'
import { door_pass } from './recover.js'
import { prepare_actor_state } from './state.js'

/**
 * @param {object} options
 * @param {string} options.url
 * @param {() => Promise<string>} [options.issue]
 * @param {typeof fetch} [options.fetcher]
 * @param {string} [options.state]
 */
export const actor_client = async ({
  url,
  issue = () => door_pass('harness-pass'),
  fetcher = fetch,
  state
}) => {
  if (!url || !/^https?:\/\//.test(url))
    throw new Error('actor sync needs a sync address')
  let pass = await issue()
  const claims = JSON.parse(
    Buffer.from(pass.split('.')[0], 'base64url').toString()
  )
  if (claims.aud !== 'realness-harness')
    throw new Error('actor sync needs a harness pass')
  const store = client({
    url,
    phone: claims.phone,
    token: async ({ refresh = false } = {}) => {
      if (refresh) pass = await issue()
      return pass
    },
    state,
    fetcher
  })
  return { store, claims }
}

/** The recovered service URL stays with persistent state. */
export const actor_url = async (root = '/realness', state_option) => {
  const state = await prepare_actor_state(root, { state: state_option })
  return (await read_file(join(state, 'recovery/url'), 'utf8')).trim()
}
