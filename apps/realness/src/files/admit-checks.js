/**
 * k2: the fixed checks a returned change passes before it moves into the
 * Mac's files. The server already checked who may write and whether the actor
 * is fenced; these check the change itself. Each failing check is a reason,
 * in words the person reads.
 */
import { MAX_BYTES } from '#root/src/files/client.js'
import { version_sync } from '#root/src/files/version-node.js'

/** Pages an actor may return into the vault. */
const PAGE = /\.(md|html|svg)$/
const SCRIPT = /<script\b|\son[a-z]+\s*=/i
const ITEMID_LINE = /^itemid:\s*"?([^"\n]+)"?\s*$/m
const ITEMID_ATTRIBUTE = /\bitemid="([^"]+)"/

/**
 * Whether a path may move in at all, or the reason it waits.
 * @param {string} path
 * @returns {string | null}
 */
const type_reason = path => {
  if (path === 'AGENTS.md' || path.startsWith('.pi/agent/sessions/'))
    return null
  if (path.startsWith('vault/'))
    return PAGE.test(path) ? null : 'only pages move into the vault'
  if (path.startsWith('work/')) return 'code comes back as a patch'
  return 'this file does not move in'
}

/**
 * The itemid a page names for itself, or null.
 * @param {string} path
 * @param {Buffer} bytes
 */
const itemid_of = (path, bytes) => {
  const text = bytes.toString('utf8')
  const found = path.endsWith('.md')
    ? ITEMID_LINE.exec(text)
    : ITEMID_ATTRIBUTE.exec(text)
  return found ? found[1].trim() : null
}

/**
 * Every reason a change waits; an empty list moves it in.
 * @param {Record<string, string>} change a quarantine page item: path, action, base
 * @param {{ bytes: Buffer | null, local: Buffer | null, phone: string }} sides the returned bytes, the Mac's copy now, and the owner
 * @returns {string[]}
 */
export const reasons_to_wait = (change, { bytes, local, phone }) => {
  const reasons = []
  const type = type_reason(change.path)
  if (type) reasons.push(type)
  const current = local ? version_sync(local) : 'new'
  if (current !== change.base)
    reasons.push('the file changed since the actor started')
  if (change.action === 'delete') return reasons
  if (!bytes) return [...reasons, 'its bytes are missing']
  if (bytes.byteLength > MAX_BYTES) reasons.push('it is too big')
  if (PAGE.test(change.path) && SCRIPT.test(bytes.toString('utf8')))
    reasons.push('it carries a script')
  if (PAGE.test(change.path)) {
    const itemid = itemid_of(change.path, bytes)
    const before = local ? itemid_of(change.path, local) : null
    if (before && itemid !== before)
      reasons.push("it changes the page's itemid")
    if (!before && itemid && !itemid.startsWith(`/${phone}/`))
      reasons.push('its itemid names someone else')
  }
  return reasons
}
