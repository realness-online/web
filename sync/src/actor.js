/** Actor turns use the same sync client, with a fresh VM-bound pass. */
import { existsSync as exists_sync } from 'node:fs'
import { readFile as read_file } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { client, state_dir } from './client.js'
import { door_pass } from './recover.js'
import { harness_exclude, is_file_entry, sync_harness } from './harness.js'
import { turn_end, turn_start } from './turns.js'

export const sync_actor = async ({ url, root = '/brayness', issue = () => door_pass('harness-pass'), fetcher = fetch, state = state_dir(), defer_edits = false }) => {
  if (!url || !/^https?:\/\//.test(url)) throw new Error('actor sync needs SYNC_URL')
  let pass = await issue()
  const claims = JSON.parse(Buffer.from(pass.split('.')[0], 'base64url').toString())
  if (claims.aud !== 'brayness-harness') throw new Error('actor sync needs a harness pass')
  const store = client({ url, phone: claims.phone, token: () => pass, fetcher: async (url, options) => {
    let response = await fetcher(url, options)
    if (response.status === 401) {
      pass = await issue()
      response = await fetcher(url, { ...options, headers: { ...options.headers, authorization: `Bearer ${pass}` } })
    }
    return response
  } })
  const sync = store.sync
  store.sync = (local, remote, options) => sync(local, remote, { ...options, state })
  // Limited actors must not list or write above their selected paths.
  if (claims.paths !== undefined) {
    const exclude = await harness_exclude(root)
    const reports = {}
    for (const path of claims.paths) {
      if (await is_file_entry(root, path)) throw new Error('actor write sync currently needs folder limits')
      reports[path] = await store.sync(join(root, path), `can://~/harness/${path}/`, {
        state, exclude: (name, is_dir) => exclude(`${path}/${name}`, is_dir),
      })
    }
    return reports
  }
  if (!exists_sync(join(root, '.ignore'))) throw new Error('actor whole-harness sync needs .ignore')
  return sync_harness({ root, store, legacy: false, defer_edits })
}

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2)
  const value = name => args[args.indexOf(`--${name}`) + 1]
  const root = process.env.BRAYNESS_ROOT || '/brayness'
  const state = state_dir({ BRAYNESS_STATE: process.env.BRAYNESS_STATE ?? join(root, 'artifacts/sync-state') })
  const session = args.includes('--session') ? value('session') : null
  if (command === 'turn-start' && session) await turn_start({ root, state, session })
  else if (command === 'sync' || (command === 'turn-end' && session)) {
    if (command === 'turn-end') await turn_end({ root, state, session, turn: Number(args.includes('--turn') ? value('turn') : 0) })
    const url = process.env.SYNC_URL ?? (await read_file(join(root, 'artifacts/sync-recovery/url'), 'utf8')).trim()
    const report = await sync_actor({ root, state, url, defer_edits: command === 'turn-end' })
    console.log(JSON.stringify(report))
  } else throw new Error('usage: actor sync | turn-start --session <file> | turn-end --session <file> --turn <n>')
}
