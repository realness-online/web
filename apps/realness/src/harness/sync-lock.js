/**
 * One turn-end sync at a time per harness. Several sessions can end a turn in
 * the same minute, and each turn-end otherwise starts a full walk alone; a
 * few together exhaust the machine. The lock holds the owner's pid, a dead
 * owner's lock is taken over, and the process removes it on exit.
 */
import {
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join } from 'node:path'

const LOCK = 'turn-sync.lock'

const alive = pid => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

const owner_alive = path => {
  try {
    const pid = Number(read_file_sync(path, 'utf8').trim())
    return pid > 0 && alive(pid)
  } catch {
    return false
  }
}

const take = path => {
  write_file_sync(path, String(process.pid), { flag: 'wx' })
  process.once('exit', () => rm_sync(path, { force: true }))
  return true
}

/**
 * Whether this process may sync now. False when another live turn-end holds
 * the lock; the turn itself is logged either way.
 * @param {string} state
 */
export const claim_turn_sync = state => {
  mkdir_sync(state, { recursive: true })
  const path = join(state, LOCK)
  try {
    return take(path)
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
  if (owner_alive(path)) return false
  rm_sync(path, { force: true })
  try {
    return take(path)
  } catch (error) {
    if (error.code === 'EEXIST') return false
    throw error
  }
}
