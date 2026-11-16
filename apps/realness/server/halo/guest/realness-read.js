#!/usr/bin/env node
/**
 * realness-read <url> [--max N] [--grep word] [--links] [--fresh] [--site <slug>] [--brief] [--json]
 *
 * Reads a page as markdown, on this Mac or in a box. Exit 1 is a usage
 * error, 2 a bot wall, 3 a page no method could read.
 *
 * Scout code in the vault for the site, or for the URL's host, reads first.
 * A `--site` names the cookie jar the read uses, so a logged-in source reads
 * signed in. In a box, a plain read asks the halo through the door; on this
 * Mac, it runs the same web engine here. The engine tries a Common Crawl copy
 * first, then the site, then Chrome, then Firecrawl. `--fresh` skips the
 * crawled copy and the cache.
 *
 * `--brief` prints the page's body alone, and `--json` the whole reply.
 */
import { execFileSync as exec_file_sync, spawn } from 'node:child_process'
import { existsSync as exists_sync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { login_of } from './realness-cookies.js'
import { ask, door_path, exit } from './realness-door.js'
import { box_cookies, find_scout_code, scout_read } from './realness-scout.js'

const HERE = dirname(file_url_to_path(import.meta.url))
const BOX_LIB = '/usr/local/lib/realness'
const EXIT_NOT_ALLOWED = 4
/** This checkout's app source: mounted read-only in a box, beside this file on a Mac. */
const LIB =
  process.env.REALNESS_LIB ??
  (exists_sync(BOX_LIB) ? BOX_LIB : resolve(HERE, '../../..'))
/** The harness root, with the vault, the saved logins, and `.pi`. */
const HOME =
  process.env.REALNESS_HOME ??
  (exists_sync('/realness/.pi') ? '/realness' : resolve(LIB, '../..'))
const VAULT = process.env.REALNESS_VAULT ?? join(HOME, 'vault')
const JARS = process.env.REALNESS_JARS ?? join(HOME, '.pi/agent/secrets/jars')
/** The guest that leases this box's own Chrome. */
const CHROME =
  process.env.REALNESS_CHROME_BIN ?? '/usr/local/bin/realness-chrome'
const MAX_CHARS = 8000
const MEGABYTE = 1_048_576
const BROWSER_BUFFER_MB = 50
const BROWSER_BUFFER = BROWSER_BUFFER_MB * MEGABYTE
const HTTP_OK = 200
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const USAGE =
  'usage: realness-read <url> [--max N] [--grep word] [--links] [--fresh] [--site <slug>] [--brief] [--json]'

const argv = process.argv.slice(2)
const VALUE_FLAGS = new Set(['--site', '--max', '--grep'])
const FLAGS = new Set(['--fresh', '--links', '--brief', '--json'])
/** @type {Record<string, string>} */
const values = {}
const args = []
for (let i = 0; i < argv.length; i += 1) {
  const flag = argv[i]
  if (VALUE_FLAGS.has(flag)) {
    values[flag] = argv[i + 1]
    i += 1
  } else if (!FLAGS.has(flag)) args.push(flag)
}
if (
  args.length !== 1 ||
  Object.entries(values).some(([, value]) => !value || value.startsWith('--'))
)
  exit(USAGE)
const [url] = args
const site = values['--site'] ?? null
const brief = argv.includes('--brief')
const fresh = argv.includes('--fresh')
const on_box = exists_sync(door_path())

if (process.env.REALNESS_READ_ALLOWED) {
  const allowed = JSON.parse(process.env.REALNESS_READ_ALLOWED)
  const { reads_inside } = await import(`${LIB}/src/scouts/sources.js`)
  if (!allowed.some(one => reads_inside(url, one))) {
    process.stderr.write(
      `realness-read: ${url} is not on this source's list. Read only these:\n${allowed.map(one => `  ${one}`).join('\n') || '  (no pages)'}\n`
    )
    process.exit(EXIT_NOT_ALLOWED)
  }
}

/**
 * Print a reply the way the caller asked for it.
 * @param {{ source: string, kind: string, body: string, title?: string, via?: string, crawled?: string, site?: string }} reply
 */
const emit = async reply => {
  if (brief) return process.stdout.write(`${reply.body ?? ''}\n`)
  if (argv.includes('--json'))
    return process.stdout.write(JSON.stringify(reply))
  const { page_text } = await import(`${HOME}/.pi/bin/lib/page-markdown.js`)
  const source = [reply.source, reply.via, reply.crawled?.slice(0, 8)]
    .filter(Boolean)
    .join(' ')
  process.stdout.write(
    `${page_text(reply, {
      url,
      source,
      max: Number(values['--max'] ?? MAX_CHARS),
      grep: values['--grep'] ?? null,
      links: argv.includes('--links')
    })}\n`
  )
}

/** @param {string} message */
const fail = message => {
  process.stderr.write(`realness-read: ${message}\n`)
  process.exit(/: blocked/.test(message) ? 2 : 3)
}

const scout = find_scout_code({ site, host: new URL(url).hostname }, VAULT)
if (scout)
  try {
    const page = await scout_read(scout, url, {
      ask,
      brief,
      saved: box_cookies(scout.site, JARS)
    })
    await emit({
      source: 'scout',
      kind: 'html',
      body: page.html,
      site: scout.site
    })
    process.exit(0)
  } catch (error) {
    process.stderr.write(
      `realness-read: ${scout.site} scout code failed, reading through the halo: ${error.message}\n`
    )
  }

/** Ask this box's Chrome for its DevTools address. */
const lease = () =>
  new Promise((done, failed) => {
    const child = spawn(CHROME, site ? ['lease', site] : [], {
      stdio: ['ignore', 'pipe', 'inherit']
    })
    let out = ''
    child.stdout.on('data', chunk => {
      out += chunk
    })
    child.on('error', failed)
    child.on('close', code =>
      code === 0 ? done(out.trim()) : failed(new Error('no Chrome lease'))
    )
  })

/** Give this box's Chrome back, cookies and all. */
const give_back = () =>
  new Promise(
    /** @param {(value?: unknown) => void} done */ done => {
      const child = spawn(CHROME, ['return'], { stdio: 'ignore' })
      child.on('error', () => done())
      child.on('close', () => done())
    }
  )

/**
 * A login site, read in a box: the jar's cookies for the server's own HTML,
 * and this box's Chrome only when that page comes back too thin to use.
 * @param {string} slug
 */
const read_site = async slug => {
  const { site_read } = await import(`${LIB}/src/halo/site-read.js`)
  const cookies = await login_of(slug, ask)
  if (!cookies.length) throw new Error(`no saved ${slug} login`)
  let leased = false
  try {
    const page = await site_read(url, {
      cookies,
      render: async target => {
        const devtools = await lease()
        leased = true
        const { render_page } = await import(`${LIB}/src/halo/render.js`)
        return render_page(new URL(devtools).host, target, {
          wait: 'content'
        })
      }
    })
    return {
      ok: true,
      source: page.source,
      kind: 'html',
      body: page.html,
      status: page.status,
      site: slug
    }
  } finally {
    if (leased) await give_back()
  }
}

const has_agent_browser = () => {
  try {
    exec_file_sync('agent-browser', ['--version'], {
      stdio: 'ignore',
      timeout: 10_000
    })
    return true
  } catch {
    return false
  }
}

/**
 * Render a page in agent-browser, waiting out one bot check.
 * @param {(html: string) => string | null} shortfall
 */
const browser_render = shortfall => target =>
  Promise.try(() => {
    const session = `realness-read-${process.pid}-${Date.now()}`
    const ab = (...a) =>
      exec_file_sync(
        'agent-browser',
        [
          '--session',
          session,
          '--user-agent',
          MAC_UA,
          '--args',
          '--disable-blink-features=AutomationControlled',
          ...a
        ],
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 45_000,
          maxBuffer: BROWSER_BUFFER
        }
      )
    try {
      ab('open', target)
      try {
        ab('wait', '--load', 'networkidle')
      } catch {}
      let html = `<html>${ab('get', 'html', 'html')}</html>`
      if (shortfall(html) === 'blocked') {
        ab('wait', '5000')
        html = `<html>${ab('get', 'html', 'html')}</html>`
      }
      const status = Number(
        ab(
          'eval',
          "performance.getEntriesByType('navigation')[0]?.responseStatus"
        ).trim()
      )
      return { status: status || HTTP_OK, html }
    } finally {
      try {
        ab('close')
      } catch {}
    }
  })

/** Render a page in this actor's own Chrome, then give the Chrome back. */
const actor_render = async target => {
  const devtools = await lease()
  try {
    const { render_page } = await import(`${LIB}/src/halo/render.js`)
    return await render_page(new URL(devtools).host, target, {
      wait: 'content'
    })
  } finally {
    await give_back()
  }
}

/**
 * A plain read where it runs: the web engine, with its cache in artifacts.
 * An actor renders in its own Chrome; a Mac in agent-browser.
 */
const read_here = async () => {
  const { COMMON_CRAWL, WebEngine, shortfall } = await import(
    `${LIB}/src/halo/web-engine.js`
  )
  const browser = has_agent_browser() ? browser_render(shortfall) : null
  const render = on_box ? actor_render : browser
  const engine = new WebEngine({
    root: join(HOME, 'artifacts', 'realness-read'),
    render,
    firecrawl_key: process.env.FIRECRAWL_API_KEY ?? null,
    common_crawl: COMMON_CRAWL
  })
  return { ok: true, ...(await engine.read(url, { fresh })) }
}

if (site && !on_box)
  exit(`realness-read: no ${site} scout code with a saved login in ${JARS}`)

if (site)
  try {
    await emit(await read_site(site))
    process.exit(0)
  } catch (error) {
    exit(`realness-read: ${error.message}`)
  }

try {
  await emit(await read_here())
} catch (error) {
  fail(error.message)
}
