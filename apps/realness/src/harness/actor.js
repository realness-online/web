/** Actor turns use the same sync client, with a fresh VM-bound pass. */
import { existsSync as exists_sync } from 'node:fs'
import { readFile as read_file } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { client, state_dir } from '#root/src/files/client.js'
import { door_pass } from './recover.js'
import { harness_exclude, is_file_entry, sync_harness } from './harness.js'
import { prepare_actor_state } from './state.js'
import { HTTP } from '#root/lib/http.js'
/* eslint-disable no-await-in-loop -- harness folders sync one at a time so a failure stops the rest */

/** A renewing VM-bound client shared by harness and file commands. */
export const actor_client = async ({
  url,
  issue = () => door_pass('harness-pass'),
  fetcher = fetch
}) => {
  if (!url || !/^https?:\/\//.test(url))
    throw new Error('actor sync needs SYNC_URL')
  let pass = await issue()
  const claims = JSON.parse(
    Buffer.from(pass.split('.')[0], 'base64url').toString()
  )
  if (claims.aud !== 'brayness-harness')
    throw new Error('actor sync needs a harness pass')
  const store = client({
    url,
    phone: claims.phone,
    token: () => pass,
    fetcher: async (url, options) => {
      let response = await fetcher(url, options)
      if (response.status === HTTP.UNAUTHORIZED) {
        pass = await issue()
        response = await fetcher(url, {
          ...options,
          headers: { ...options.headers, authorization: `Bearer ${pass}` }
        })
      }
      return response
    }
  })
  return { store, claims }
}

/** The recovered service URL stays with persistent state. */
export const actor_url = async (root = '/brayness', state_option) => {
  const state = await prepare_actor_state(root, { state: state_option })
  return (
    process.env.SYNC_URL ??
    (await read_file(join(state, 'recovery/url'), 'utf8')).trim()
  )
}

/**
 * Sync one actor through its own host pass.
 * @param {object} options
 * @param {string} options.url
 * @param {string} [options.root]
 * @param {() => Promise<string>} [options.issue]
 * @param {typeof fetch} [options.fetcher]
 * @param {string} [options.state]
 * @param {boolean} [options.defer_edits]
 */
export const sync_actor = async ({
  url,
  root = '/brayness',
  issue,
  fetcher = fetch,
  state = state_dir(),
  defer_edits = false
}) => {
  const { store, claims } = await actor_client({ url, issue, fetcher })
  const { sync } = store
  store.sync = (local, remote, options) =>
    sync(local, remote, { ...options, state })
  if (claims.paths !== undefined) {
    const exclude = await harness_exclude(root)
    const reports = {}
    for (const path of claims.paths) {
      if (await is_file_entry(root, path)) {
        if (exclude(path, false)) continue
        const folder = dirname(path)
        const remote = `can://~/harness/${folder === '.' ? '' : `${folder}/`}`
        const version = await store.version(`can://~/harness/${path}`)
        reports[path] = await store.sync(join(root, folder), remote, {
          state,
          only: [basename(path)],
          remote_files: version ? { [basename(path)]: version } : {},
          exclude: (name, is_dir) =>
            exclude(folder === '.' ? name : `${folder}/${name}`, is_dir)
        })
        continue
      }
      reports[path] = await store.sync(
        join(root, path),
        `can://~/harness/${path}/`,
        {
          state,
          exclude: (name, is_dir) => exclude(`${path}/${name}`, is_dir)
        }
      )
    }
    return reports
  }
  if (!exists_sync(join(root, '.ignore')))
    throw new Error('actor whole-harness sync needs .ignore')
  return sync_harness({ root, store, defer_edits })
}
