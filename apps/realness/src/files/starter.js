/** Starter hashes supply a base to sync; they never trigger a user prompt. */
import { createHash as create_hash } from 'node:crypto'
import { readFile as read_file } from 'node:fs/promises'
import { join } from 'node:path'
import { limit_path } from './paths.js'
import { HTTP } from '#root/lib/http.js'

export const STARTER_DIRECTORY = '/usr/local/share/realness-starter'
/** The shipped file list, inside the harness folder of every home. */
export const STARTER_FILE = '.pi/starter.json'

const hash = bytes =>
  bytes === null ? null : create_hash('sha256').update(bytes).digest('hex')
const regular = value =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)

/** A saved starter is optional: without a base, existing files stay personal. */
export const starter_base = async (api, folder, directory) => {
  if (!directory) return null
  const latest = JSON.parse(
    await read_file(join(directory, STARTER_FILE), 'utf8')
  )
  let previous, previous_bytes
  try {
    previous_bytes = await api.cat(`${folder}${STARTER_FILE}`)
    previous = JSON.parse(previous_bytes.toString())
  } catch (error) {
    if (error.status !== HTTP.NOT_FOUND) throw error
  }
  for (const manifest of [latest, previous].filter(Boolean)) {
    if (
      !regular(manifest.version) ||
      !manifest.files ||
      typeof manifest.files !== 'object' ||
      Array.isArray(manifest.files)
    )
      throw new Error('invalid starter manifest')
    if (
      manifest.built_at !== undefined &&
      (typeof manifest.built_at !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
          manifest.built_at
        ) ||
        !Number.isFinite(Date.parse(manifest.built_at)))
    )
      throw new Error('invalid starter build date')
    for (const [name, value] of Object.entries(manifest.files))
      if (
        !limit_path(name) ||
        (!regular(value) &&
          !(typeof value === 'string' && value.startsWith('link:')))
      )
        throw new Error(`invalid starter path: ${name}`)
  }
  if (
    previous?.built_at &&
    !latest.built_at &&
    previous.version !== latest.version
  )
    throw new Error(
      'starter build has no date; refusing an unknown upgrade order'
    )
  const outdated = Boolean(
    previous?.built_at &&
    latest.built_at &&
    previous.version !== latest.version &&
    previous.built_at >= latest.built_at
  )
  let deferred = {}
  try {
    deferred = JSON.parse(
      (await api.cat(`${folder}.pi/agent/deferred.json`)).toString()
    )
  } catch (error) {
    if (error.status !== HTTP.NOT_FOUND) throw error
  }
  const pending = new Set(Object.keys(deferred))
  return { latest, previous, previous_bytes, directory, outdated, pending }
}

/** Decide only managed-file differences. Other differences use normal sync. */
export const starter_choice = (starter, name, ours, theirs) => {
  const old_hash = starter.previous?.files[name]
  const new_hash = starter.latest.files[name]
  if (
    (!regular(old_hash) && old_hash !== undefined) ||
    (!regular(new_hash) && new_hash !== undefined)
  )
    return 'normal'
  if (old_hash === undefined && new_hash === undefined) return 'normal'
  if (starter.outdated) {
    const local_hash = hash(ours)
    if (ours !== null && local_hash !== old_hash && local_hash !== new_hash)
      return 'personal'
    return theirs === null ? 'remove-local' : 'remote'
  }
  const local_hash = hash(ours)
  const remote_hash = hash(theirs)
  const local_stock =
    local_hash === old_hash ||
    local_hash === new_hash ||
    (ours === null && new_hash === undefined)
  if (old_hash !== undefined && ours === null && new_hash !== undefined)
    return theirs === null ? 'remove-local' : 'keep-local'
  if (!local_stock && ours !== null) return 'personal'
  if (old_hash !== undefined && remote_hash !== old_hash)
    return theirs === null ? 'remove-local' : 'remote'
  if (old_hash === undefined && theirs !== null) return 'remote'
  return new_hash === undefined ? 'remove' : 'latest'
}

/** Verify the distributed bytes before they can become someone's file. */
export const starter_bytes = async (starter, name) => {
  const bytes = await read_file(join(starter.directory, name))
  if (hash(bytes) !== starter.latest.files[name])
    throw new Error(`starter hash mismatch: ${name}`)
  return bytes
}
