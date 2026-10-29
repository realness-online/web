import {
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { dirname } from 'node:path'
import { out_path } from '#root/src/settings/output.js'

/** Where `realness local halo up` says what it is doing, for the gate to repeat. */
const halo_status_path = () => out_path('local', 'halo-status.json')

/**
 * Record the local halo's current step.
 * @param {'starting' | 'up' | 'failed' | 'stopped'} state
 * @param {string} [doing]
 */
export const write_halo_status = (state, doing = '') => {
  const path = halo_status_path()
  mkdir_sync(dirname(path), { recursive: true })
  write_file_sync(
    path,
    `${JSON.stringify({ state, doing, since: new Date().toISOString() })}\n`
  )
}

/** The recorded step, or null when nothing has been recorded. */
const read_halo_status = () => {
  try {
    return JSON.parse(read_file_sync(halo_status_path(), 'utf8'))
  } catch {
    return null
  }
}

const clock = iso =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/** What a person should read while the halo does not answer. */
export const explain_halo = (status = read_halo_status()) => {
  if (status?.state === 'starting')
    return `Realness is starting on this computer: ${status.doing} (since ${clock(status.since)}). This page retries on its own.`
  if (status?.state === 'failed')
    return `Realness did not start on this computer: ${status.doing}. Check the terminal running npm run local.`
  if (status?.state === 'stopped')
    return 'Realness is stopped on this computer. Start it with npm run local.'
  return 'The agent server is not answering. If npm run local is starting, wait; otherwise start it.'
}
