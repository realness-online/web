/**
 * Manage an environment's global admins: `admins.html` at the bucket root.
 * Sync reads it (src/sync/admins.js) and `can()` denies the key to everyone,
 * so only the bucket owner's credentials write it. This is that writer.
 *
 *   <ul><li><a href="tel:+14156667777">Scott</a></li></ul>
 *
 * Writes are conditional on the version that was read, so two operators
 * cannot silently overwrite each other. Removing the last admin is refused.
 */
import { read_admins } from "#root/src/sync/admins.js"

const PHONE = /^\+[1-9]\d{6,14}$/
const ENTRY = /<a\b[^>]*href="tel:(\+[1-9]\d{6,14})"[^>]*>([\s\S]*?)<\/a>/g
const TAGS = /<[^>]*>/g

const escape = (text) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
const unescape = (text) => text.replace(/&(amp|lt|gt|quot);/g, (_, name) => ({ amp: "&", lt: "<", gt: ">", quot: '"' })[name])

/** Every admin with the name its link shows; the first link for a phone wins. */
export const parse_admins = (html) => {
  const found = new Map()
  for (const [, phone, label] of html.matchAll(ENTRY)) {
    if (!found.has(phone)) found.set(phone, unescape(label.replace(TAGS, "")).trim())
  }
  return [...found].map(([phone, name]) => ({ phone, name }))
}

/** The page sync reads; `read_admins` must see exactly these phones. */
export const render_admins = (list) => {
  const items = list.map(({ phone, name }) => `  <li><a href="tel:${phone}">${escape(name || phone)}</a></li>`)
  return `<!doctype html>\n<title>Admins</title>\n<ul>\n${items.join("\n")}\n</ul>\n`
}

const check_phone = (phone) => {
  if (typeof phone !== "string" || !PHONE.test(phone)) throw new Error(`admin phone must look like +14155551234, not ${JSON.stringify(phone)}`)
  return phone
}

/** What a change would leave, without writing; throws when the change is unsafe. */
export const plan_admins = (list, { verb, phone, name = "" }) => {
  if (verb === "list") return { list, changed: false }
  check_phone(phone)
  const present = list.some((admin) => admin.phone === phone)
  if (verb === "add") {
    if (present) return { list, changed: false, note: `${phone} is already an admin` }
    return { list: [...list, { phone, name: name.trim() }], changed: true }
  }
  if (verb === "remove") {
    if (!present) return { list, changed: false, note: `${phone} is not an admin` }
    if (list.length === 1) throw new Error("refusing to remove the last admin; add another first")
    return { list: list.filter((admin) => admin.phone !== phone), changed: true }
  }
  throw new Error("usage: webspace <env> admins list | add <phone> [name] | remove <phone> [--yes]")
}

/**
 * Read, plan, and (with `yes`) write. Without `yes` nothing is written and
 * the result says what would change.
 */
export const manage_admins = async (storage, { verb = "list", phone, name, yes = false } = {}) => {
  const page = await storage.get("admins.html")
  const before = parse_admins(page ? page.body.toString("utf8") : "")
  const { list, changed, note } = plan_admins(before, { verb, phone, name })
  const result = { before, after: list, changed, written: false, ...(note ? { note } : {}) }
  if (!changed || !yes) return result
  const html = render_admins(list)
  const written = read_admins(html)
  if (written.size !== list.length || !list.every((admin) => written.has(admin.phone))) throw new Error("rendered admins page does not round-trip")
  await storage.put("admins.html", html, { if_version: page ? page.version : null })
  return { ...result, written: true }
}

/**
 * Make sure `people` are admins, keeping everyone already listed. With
 * `create_only`, an existing page is left exactly as it is: a new environment
 * gets its first admin, and a running one is never edited behind its admins.
 */
export const ensure_admins = async (storage, people, { create_only = false } = {}) => {
  const wanted = people.filter(Boolean).map(({ phone, name = "" }) => ({ phone: check_phone(phone), name }))
  const page = await storage.get("admins.html")
  const before = parse_admins(page ? page.body.toString("utf8") : "")
  if (page && create_only) return { before, after: before, changed: false, written: false, note: "admins.html exists; left as is" }
  const after = [...before, ...wanted.filter((admin) => !before.some((known) => known.phone === admin.phone))]
  if (!after.length) throw new Error("no first admin: add person.local.html with your telephone link, then rerun")
  if (page && after.length === before.length) return { before, after, changed: false, written: false, note: "admins already listed" }
  await storage.put("admins.html", render_admins(after), { if_version: page ? page.version : null })
  return { before, after, changed: true, written: true }
}

/** The hint a refused operator sees instead of a bare 403. */
export const not_admin_hint = (env, phone) =>
  `${phone ?? "this account"} is signed in but is not an admin in ${env}. ` +
  `An admin can run: webspace ${env} admins add ${phone ?? "<your phone>"} --yes`

/** Plain text for the terminal; phones are masked by the caller's output rule. */
export const admins_text = ({ before, after, changed, written, note }, { verb = "list" } = {}) => {
  const lines = (list) => (list.length ? list.map(({ phone, name }) => `  ${phone}${name ? `  ${name}` : ""}`).join("\n") : "  (none)")
  if (verb === "list") return `admins:\n${lines(after)}`
  if (verb === "init") return written ? `first admin:\n${lines(after)}` : note
  if (!changed) return note
  return `${written ? "wrote" : "would write (rerun with --yes)"} admins:\n${lines(after)}\nwas:\n${lines(before)}`
}
