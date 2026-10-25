import { spawnSync as spawn_sync } from 'node:child_process'
import { mkdtempSync as mkdtemp_sync, rmdirSync as rmdir_sync } from 'node:fs'
import { HaloError } from './errors.js'

const OUTPUT_LIMIT_BITS = 28
const NOT_FOUND_CODE = 127
/** Actor TAPs are 172.16.<n>.0/30 in a /16; tap0 is the seed, so 1..254. */
export const LAST_TAP = 254
const UNIX_PATH_MAX = 108
const DEFAULT_NET = '172.16'

const REFLINK_FILESYSTEMS = ['xfs', 'btrfs']

/**
 * Run a halo command; output is stdout and stderr together, as text.
 * @param {string[]} argv
 * @param {{ check?: boolean, input?: Buffer | string }} [options]
 */
export const run = (argv, { check = true, input } = {}) => {
  const result = spawn_sync(argv[0], argv.slice(1), {
    input,
    encoding: 'utf8',
    maxBuffer: 1 << OUTPUT_LIMIT_BITS
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const code = result.status ?? (result.error ? NOT_FOUND_CODE : 1)
  if (check && code !== 0)
    throw new HaloError(`${argv.join(' ')}: exit ${code}\n${output.trim()}`)
  return { code, output }
}

/** @param {string} what */
export const require_root = what => {
  if (process.geteuid?.() !== 0)
    throw new HaloError(`${what} needs root: re-run with sudo`)
}

/**
 * @param {string} path
 * @param {string} fix - what to tell the user to do when it is not mounted
 */
export const require_mount = (path, fix) => {
  if (run(['mountpoint', '-q', path], { check: false }).code !== 0)
    throw new HaloError(`${path} is not a mount point - ${fix}`)
}

/**
 * Reflink is how an actor disk is made; not fatal here, the first create says so.
 * @param {string} path
 * @returns {string | null} the warning, or null when the filesystem reflinks
 */
export const reflink_warning = path => {
  const kind = run(['stat', '-f', '-c', '%T', path]).output.trim()
  if (REFLINK_FILESYSTEMS.includes(kind)) return null
  return `${path} is ${kind}, not ${REFLINK_FILESYSTEMS.join(' or ')}: actor disks will not reflink`
}

/** @param {string} name */
export const tap_exists = name =>
  run(['ip', 'link', 'show', name], { check: false }).code === 0

/**
 * The lowest numbered free TAP. tap0 belongs to net-up.sh.
 * @param {string} prefix
 * @param {number} [first]
 * @param {number} [last]
 */
export const free_tap = (prefix, first = 1, last = LAST_TAP) => {
  for (let index = first; index <= last; index++)
    if (!tap_exists(`${prefix}${index}`)) return `${prefix}${index}`

  throw new HaloError(`no free TAP in ${prefix}${first}..${last}`)
}

const tap_index = name => {
  const match = /(\d+)$/.exec(name)
  if (!match) throw new HaloError(`no index in TAP name ${name}`)
  return Number(match[1])
}

const tap_gateway = (name, net = DEFAULT_NET) => `${net}.${tap_index(name)}.1`

/**
 * @param {string} name
 * @param {string} [net] - the first two octets
 */
export const tap_guest = (name, net = DEFAULT_NET) =>
  `${net}.${tap_index(name)}.2`

/**
 * @param {string} name
 * @param {string} [net] - the first two octets
 */
export const create_tap = (name, net = DEFAULT_NET) => {
  run(['ip', 'tuntap', 'add', 'dev', name, 'mode', 'tap'])
  run(['ip', 'addr', 'add', `${tap_gateway(name, net)}/30`, 'dev', name])
  run(['ip', 'link', 'set', name, 'up'])
}

/** @param {string} name */
export const delete_tap = name => {
  if (tap_exists(name)) run(['ip', 'link', 'del', name])
}

const tap_ready = (name, net = DEFAULT_NET) => {
  const shown = run(['ip', '-4', 'addr', 'show', 'dev', name], {
    check: false
  })
  return (
    shown.code === 0 &&
    shown.output.includes(`inet ${tap_gateway(name, net)}/30`) &&
    /[<,]UP[,>]/.test(shown.output)
  )
}

/**
 * A woken actor keeps its TAP name, because its address is baked in. A halo
 * restart drops TAPs, and Firecracker then opens a bare one: down, no gateway,
 * so the actor has no network. Rebuild it unless it is already ready.
 * @param {string} name
 * @param {{
 *   net?: string,
 *   ready?: (name: string, net: string) => boolean,
 *   remove?: (name: string) => void,
 *   create?: (name: string, net: string) => void
 * }} [options] - net is the first two octets; the rest are injectable for tests
 * @returns {boolean} true when the TAP was rebuilt
 */
export const ensure_tap = (
  name,
  {
    net = DEFAULT_NET,
    ready = tap_ready,
    remove = delete_tap,
    create = create_tap
  } = {}
) => {
  if (ready(name, net)) return false
  remove(name)
  create(name, net)
  return true
}

/**
 * AF_UNIX paths cap at 108 bytes; longer is a confusing error at load time.
 * @param {string} path
 */
export const short_enough_for_unix = path =>
  Buffer.byteLength(path) < UNIX_PATH_MAX

/**
 * Mount a stopped actor's disk for the length of `work`. Stopped, because a
 * running guest writes under the mount. The mount point is on /run (tmpfs),
 * so a stale mount never makes the volume look non-empty.
 * @template T
 * @param {string} disk
 * @param {(where: string) => Promise<T> | T} work
 * @param {{ readonly?: boolean }} [options]
 * @returns {Promise<T>}
 */
export const mounted = async (disk, work, { readonly = false } = {}) => {
  const where = mkdtemp_sync('/run/realness-mnt-')
  try {
    run(['mount', '-o', readonly ? 'loop,ro' : 'loop', disk, where])
  } catch (error) {
    rmdir_sync(where)
    throw error
  }
  let outcome
  try {
    outcome = { value: await work(where) }
  } catch (error) {
    outcome = { error }
  }
  const result = run(['umount', where], { check: false })
  if (result.code !== 0)
    throw new HaloError(`could not unmount ${where}: ${result.output.trim()}`)
  rmdir_sync(where)
  if (outcome.error) throw outcome.error
  return outcome.value
}
