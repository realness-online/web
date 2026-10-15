import { spawnSync as spawn_sync } from 'node:child_process'
import { mkdtempSync as mkdtemp_sync, rmdirSync as rmdir_sync } from 'node:fs'
import { HostError } from './errors.js'

const OUTPUT_LIMIT_BITS = 28
const NOT_FOUND_CODE = 127
const LAST_TAP = 63
const UNIX_PATH_MAX = 108

const REFLINK_FILESYSTEMS = ['xfs', 'btrfs']

/**
 * Run a host command; output is stdout and stderr together, as text.
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
    throw new HostError(`${argv.join(' ')}: exit ${code}\n${output.trim()}`)
  return { code, output }
}

/** @param {string} what */
export const requireRoot = what => {
  if (process.geteuid?.() !== 0)
    throw new HostError(`${what} needs root: re-run with sudo`)
}

export const requireMount = (path, fix) => {
  if (run(['mountpoint', '-q', path], { check: false }).code !== 0)
    throw new HostError(`${path} is not a mount point - ${fix}`)
}

/** Reflink is how an actor disk is made; not fatal here, the first create says so. */
export const reflinkWarning = path => {
  const kind = run(['stat', '-f', '-c', '%T', path]).output.trim()
  if (REFLINK_FILESYSTEMS.includes(kind)) return null
  return `${path} is ${kind}, not ${REFLINK_FILESYSTEMS.join(' or ')}: actor disks will not reflink`
}

export const tapExists = name =>
  run(['ip', 'link', 'show', name], { check: false }).code === 0

/** The lowest numbered free TAP. tap0 belongs to net-up.sh. */
export const freeTap = (prefix, first = 1, last = LAST_TAP) => {
  for (let index = first; index <= last; index++)
    if (!tapExists(`${prefix}${index}`)) return `${prefix}${index}`

  throw new HostError(`no free TAP in ${prefix}${first}..${last}`)
}

const tapIndex = name => {
  const match = /(\d+)$/.exec(name)
  if (!match) throw new HostError(`no index in TAP name ${name}`)
  return Number(match[1])
}

const tapGateway = (name, net = '172.16') => `${net}.${tapIndex(name)}.1`
export const tapGuest = (name, net = '172.16') => `${net}.${tapIndex(name)}.2`

export const createTap = (name, net) => {
  run(['ip', 'tuntap', 'add', 'dev', name, 'mode', 'tap'])
  run(['ip', 'addr', 'add', `${tapGateway(name, net)}/30`, 'dev', name])
  run(['ip', 'link', 'set', name, 'up'])
}

export const deleteTap = name => {
  if (tapExists(name)) run(['ip', 'link', 'del', name])
}

const tapReady = name => {
  const shown = run(['ip', '-4', 'addr', 'show', 'dev', name], { check: false })
  return (
    shown.code === 0 &&
    shown.output.includes(`inet ${tapGateway(name)}/30`) &&
    /[<,]UP[,>]/.test(shown.output)
  )
}

/**
 * A woken actor keeps its TAP name, because its address is baked in. A host
 * restart drops TAPs, and Firecracker then opens a bare one: down, no gateway,
 * so the actor has no network. Rebuild it unless it is already ready.
 */
export const ensureTap = (
  name,
  { ready = tapReady, remove = deleteTap, create = createTap } = {}
) => {
  if (ready(name)) return false
  remove(name)
  create(name)
  return true
}

/** AF_UNIX paths cap at 108 bytes; longer is a confusing error at load time. */
export const shortEnoughForUnix = path =>
  Buffer.byteLength(path) < UNIX_PATH_MAX

/**
 * Mount a stopped actor's disk for the length of `work`. Stopped, because a
 * running guest writes under the mount. The mount point is on /run (tmpfs),
 * so a stale mount never makes the volume look non-empty.
 */
export const mounted = async (disk, work, { readonly = false } = {}) => {
  const where = mkdtemp_sync('/run/brayness-mnt-')
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
    throw new HostError(`could not unmount ${where}: ${result.output.trim()}`)
  rmdir_sync(where)
  if (outcome.error) throw outcome.error
  return outcome.value
}
