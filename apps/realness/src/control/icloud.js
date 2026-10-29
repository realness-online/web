/* eslint-disable no-await-in-loop -- each poll follows the previous iCloud answer */
import { setTimeout as delay } from 'node:timers/promises'
import { MS_PER_MINUTE, MS_PER_SECOND } from '#root/lib/units.js'
import { run as run_command } from './exec.js'

const POLL_MS = 2 * MS_PER_SECOND
const WAIT_MINUTES = 30
export const WAIT_TIMEOUT_MS = WAIT_MINUTES * MS_PER_MINUTE
// eslint-disable-next-line no-control-regex -- brctl colors its output
const ANSI = /\u001b\[[0-9;]*m/g
const CONTAINER = /^<c\{.*\}\S*\[\d+\]/
const HEADER = /^\d+ containers? matching/
const FOOTER = /^Desktop & Documents:/

/**
 * @typedef {object} IcloudStatus
 * @property {number} containers
 * @property {number} caught
 * @property {number} pending_items
 * @property {boolean} ready
 */

/**
 * Read `brctl status` without exposing the private data in its container lines.
 * Any line that is not a container, header, or footer counts as pending work.
 * @param {string} text
 * @returns {IcloudStatus}
 */
export const parse_icloud_status = text => {
  const lines = text
    .replace(ANSI, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
  const containers = lines.filter(line => CONTAINER.test(line))
  const pending_items = lines.filter(
    line => !CONTAINER.test(line) && !HEADER.test(line) && !FOOTER.test(line)
  ).length
  const caught = containers.filter(line => line.includes('caught-up')).length
  return {
    containers: containers.length,
    caught,
    pending_items,
    ready:
      containers.length > 0 &&
      caught === containers.length &&
      pending_items === 0
  }
}

/**
 * Current iCloud readiness. The container lines carry private tokens, so only
 * their counts leave this module.
 * @param {{ run?: (command: string, args: string[]) => Promise<string> }} [options]
 * @returns {Promise<IcloudStatus>}
 */
export const icloud_status = async ({ run = run_command } = {}) =>
  parse_icloud_status(await run('brctl', ['status']))

/**
 * Wait for iCloud to catch up, reporting each change.
 * @param {object} [options]
 * @param {() => Promise<IcloudStatus>} [options.read]
 * @param {(status: IcloudStatus) => void} [options.on_status]
 * @param {number} [options.timeout_ms]
 * @param {number} [options.interval_ms]
 * @param {(ms: number) => Promise<unknown>} [options.sleep]
 * @param {() => number} [options.now]
 * @returns {Promise<IcloudStatus & { timed_out: boolean }>}
 */
export const wait_for_icloud = async ({
  read = icloud_status,
  on_status = () => {},
  timeout_ms = WAIT_TIMEOUT_MS,
  interval_ms = POLL_MS,
  sleep = delay,
  now = Date.now
} = {}) => {
  const deadline = now() + timeout_ms
  let status = await read()
  on_status(status)
  while (!status.ready && now() < deadline) {
    await sleep(interval_ms)
    status = await read()
    on_status(status)
  }
  return { ...status, timed_out: !status.ready }
}

/** One line a person can read, with no container token. */
export const describe_icloud_status = status =>
  status.containers
    ? `iCloud: ${status.caught} of ${status.containers} containers caught up${status.pending_items ? `; ${status.pending_items} pending items` : ''}`
    : 'iCloud: no containers found'
