#!/usr/bin/env node
/**
 * Move a logged-in site's cookies into the halo's jar.
 *
 *     node scripts/cookie-import.js --from http://127.0.0.1:9333 \
 *       --domain workatastartup.com --json cookies.json
 *
 *     node scripts/cookie-import.js --json cookies.json \
 *       --owner +16282281824 --site yc --root /opt/fc/boxes/cookie-jars
 *
 * The first form reads a Chrome's cookies over DevTools; the second writes
 * them to a jar page. Run the first on the Mac that holds the login, the
 * second in the halo.
 */
import {
  readFile as read_file,
  writeFile as write_file
} from 'node:fs/promises'
import { cookie_jars, devtools_cookies } from '#root/src/halo/cookie-jar.js'
import { run_entry } from './lib/entry.js'

/**
 * Whether a cookie belongs to `domain` and the hosts below it.
 * @param {string} cookie_domain
 * @param {string} domain
 */
export const under = (cookie_domain, domain) => {
  const bare = String(cookie_domain ?? '')
    .replace(/^\./, '')
    .toLowerCase()
  return bare === domain || bare.endsWith(`.${domain}`)
}

/**
 * @param {object} options
 * @param {string[]} options.args
 * @param {typeof devtools_cookies} [options.cookies]
 * @param {{ write: (line: string) => void }} [options.out]
 */
export const main = async ({
  args = process.argv.slice(2),
  cookies = devtools_cookies,
  out = process.stdout
} = {}) => {
  const flag = name => {
    const at = args.indexOf(`--${name}`)
    return at === -1 ? null : (args[at + 1] ?? null)
  }
  const from = flag('from')
  const json = flag('json')
  if (from) {
    const domain = flag('domain')
    if (!domain) throw new Error('reading a Chrome needs --domain')
    const found = (await cookies.get(from)).filter(cookie =>
      under(cookie.domain, domain)
    )
    if (!found.length) throw new Error(`no cookies for ${domain} at ${from}`)
    if (json) await write_file(json, `${JSON.stringify(found, null, 2)}\n`)
    out.write(`${found.length} cookies for ${domain}\n`)
    return found
  }
  const owner = flag('owner')
  const site = flag('site')
  const root = flag('root')
  if (!json || !owner || !site || !root)
    throw new Error('writing a jar needs --json, --owner, --site, --root')
  const found = JSON.parse(await read_file(json, 'utf8'))
  await cookie_jars(root).save(owner, site, found)
  out.write(`${found.length} cookies in ${site} for ${owner}\n`)
  return found
}

await run_entry(import.meta.url, main)
