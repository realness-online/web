/**
 * Global admins: phone numbers as `tel:` links in `admins.html`, at the
 * bucket root. `can()` denies that key to everyone, so only someone with
 * the bucket's own key edits it. Read at most every 30 seconds.
 *
 *   <a href="tel:+14156667777">Scott</a>
 */
const TEL = /href="tel:(\+[1-9]\d{6,14})"/g
const FRESH_MS = 30_000

export const read_admins = (html) => new Set([...html.matchAll(TEL)].map(([, phone]) => phone))

export function admins(storage, { now = Date.now } = {}) {
  let cached = null
  let until = 0
  return {
    async has(phone) {
      if (!cached || now() >= until) {
        const page = await storage.get("admins.html")
        cached = read_admins(page ? page.body.toString("utf8") : "")
        until = now() + FRESH_MS
      }
      return cached.has(phone)
    },
  }
}
