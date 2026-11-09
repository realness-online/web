import {
  chmod,
  mkdir,
  readFile as read_file,
  rename,
  writeFile as write_file
} from 'node:fs/promises'
import { join } from 'node:path'
import { escape, item_html, read_items } from '#root/lib/items.js'

/** Only the halo's own user reads a jar: it holds a logged-in session. */
const OWNER_ONLY = 0o600
const SITE = /^[a-z0-9-]{1,40}$/
const OWNER = /^\+[1-9]\d{6,14}$/
const DEVTOOLS_WAIT_MS = 15_000
/** DevTools answers at once or not at all; wait this long for one call. */
const REPLY_MS = DEVTOOLS_WAIT_MS

/**
 * One cookie as DevTools hands it out and takes it back.
 * @typedef {object} Cookie
 * @property {string} name
 * @property {string} value
 * @property {string} domain
 * @property {string} path
 * @property {number} expires seconds since the epoch; -1 for a session cookie
 * @property {boolean} httpOnly
 * @property {boolean} secure
 * @property {string} [sameSite]
 */

/** A site's name as a jar names it: a short slug, so no path escapes the folder. */
export const site_of = value => {
  const site = String(value ?? '')
  if (!SITE.test(site)) throw new Error(`site must be a short slug: ${site}`)
  return site
}

/** @param {Cookie} cookie */
const fields_of = cookie => ({
  name: cookie.name,
  value: cookie.value,
  domain: cookie.domain,
  path: cookie.path,
  expires: String(cookie.expires),
  httpOnly: String(Boolean(cookie.httpOnly)),
  secure: String(Boolean(cookie.secure)),
  sameSite: cookie.sameSite ?? ''
})

/** @param {Record<string, string>} item @returns {Cookie} */
const cookie_of = item => ({
  name: item.name,
  value: item.value,
  domain: item.domain,
  path: item.path || '/',
  expires: Number(item.expires),
  httpOnly: item.httpOnly === 'true',
  secure: item.secure === 'true',
  ...(item.sameSite ? { sameSite: item.sameSite } : {})
})

/** A jar as a page: one `/cookie` item per cookie. */
export const jar_page = (site, cookies) =>
  `<!doctype html>\n<title>${escape(site)} cookies</title>\n${cookies
    .map(cookie => item_html('cookie', fields_of(cookie)))
    .join('')}`

/** The cookies a jar page holds. */
export const read_jar = html => read_items(html, 'cookie').map(cookie_of)

/**
 * One owner's saved logins, a page per site, in a folder only the halo reads.
 * @param {string} root
 */
export const cookie_jars = root => {
  const path_of = (owner, site) => {
    if (!OWNER.test(owner)) throw new Error('a jar needs a verified owner')
    return join(root, owner, `${site_of(site)}.html`)
  }
  return {
    /** @param {string} owner @param {string} site @returns {Promise<Cookie[]>} */
    load: async (owner, site) =>
      read_jar(
        await read_file(path_of(owner, site), 'utf8').catch(error => {
          if (error.code === 'ENOENT') return ''
          throw error
        })
      ),
    /** Written whole, then moved into place. @param {string} owner @param {string} site @param {Cookie[]} cookies */
    save: async (owner, site, cookies) => {
      const path = path_of(owner, site)
      await mkdir(join(root, owner), { recursive: true, mode: 0o700 })
      const tmp = `${path}.tmp`
      await write_file(tmp, jar_page(site, cookies), { mode: OWNER_ONLY })
      await chmod(tmp, OWNER_ONLY)
      await rename(tmp, path)
    }
  }
}

/**
 * One browser-level DevTools call on the Chrome whose DevTools answers at
 * `devtools`, like `http://172.19.1.2:9222`.
 * @param {string} devtools
 * @param {string} method
 * @param {object} [params]
 */
const browser_call = async (devtools, method, params = {}) => {
  const reply = await fetch(`${devtools}/json/version`, {
    signal: AbortSignal.timeout(REPLY_MS)
  })
  const { webSocketDebuggerUrl } = await reply.json()
  const socket = new WebSocket(webSocketDebuggerUrl)
  try {
    return await new Promise((done, fail) => {
      const timer = setTimeout(
        () => fail(new Error(`${method}: no reply`)),
        REPLY_MS
      )
      socket.onerror = () => fail(new Error('DevTools socket failed'))
      socket.onopen = () =>
        socket.send(JSON.stringify({ id: 1, method, params }))
      socket.onmessage = ({ data }) => {
        const message = JSON.parse(data)
        if (message.id !== 1) return
        clearTimeout(timer)
        if (message.error) fail(new Error(message.error.message))
        else done(message.result)
      }
    })
  } finally {
    socket.close()
  }
}

/** Cookies in and out of any Chrome, through its DevTools. */
export const devtools_cookies = {
  /** @param {string} devtools @returns {Promise<Cookie[]>} */
  get: async devtools =>
    (await browser_call(devtools, 'Storage.getCookies')).cookies,
  /** @param {string} devtools @param {Cookie[]} cookies */
  set: async (devtools, cookies) => {
    if (cookies.length)
      await browser_call(devtools, 'Storage.setCookies', { cookies })
  }
}
