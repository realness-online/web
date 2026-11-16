#!/usr/bin/env node
/**
 * realness chrome [lease [site]|return] - lease this box's own Chrome, or give
 * it back.
 *
 * A lease prints the DevTools address; connect agent-browser to it:
 *
 *     agent-browser connect "$(realness chrome)"
 *
 * A `site` loads that site's saved login into the copy and saves it back on
 * return, so a login survives across runs:
 *
 *     agent-browser connect "$(realness chrome lease yc)"
 *
 * The jar stays on the halo: the door hands the cookies over and takes them
 * back, and the Chrome runs here, in the box that holds it.
 */
import { spawn } from 'node:child_process'
import { createServer as create_server } from 'node:net'
import {
  readFileSync as read_file_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { mkdirSync as mkdir_sync } from 'node:fs'
import { join } from 'node:path'
import { ask, exit } from './realness-door.js'
import { login_of, save_login } from './realness-cookies.js'
/* eslint-disable no-await-in-loop -- a lease starts one Chrome, then waits for it */

const [action, site] = process.argv.slice(2)
if (![undefined, 'lease', 'return'].includes(action))
  exit('usage: realness chrome [lease [site]|return]')
if (site && action === 'return')
  exit('usage: realness chrome [lease [site]|return]')

const DEFAULT_PORT = 9223
const PORTS = 20
const WAIT_MS = 20_000
const REPLY_MS = 3000
const POLL_MS = 100
const MINUTES = 30
const MS_PER_MINUTE = 60_000
const SHELL = process.env.REALNESS_CHROME_SHELL ?? '/opt/chrome/headless_shell'
const DIR = process.env.REALNESS_CHROME_DIR ?? '/realness/artifacts/tmp'
const PORT = Number(process.env.REALNESS_CHROME_PORT ?? DEFAULT_PORT)
const LIB = process.env.REALNESS_LIB ?? '/usr/local/lib/realness'
const lease_file = join(DIR, `realness-chrome-${process.getuid?.() ?? 0}.json`)

/** The lease this box holds, or null when it holds none. */
const held = () => {
  try {
    return JSON.parse(read_file_sync(lease_file, 'utf8'))
  } catch {
    return null
  }
}

/** Whether a Chrome answers at the address this box leased. */
const answers = async url => {
  try {
    const reply = await fetch(`${url}/json/version`, {
      signal: AbortSignal.timeout(REPLY_MS)
    })
    return reply.ok
  } catch {
    return false
  }
}

/** A free port near PORT, so two leases never collide. */
const port_for = async () => {
  for (let port = PORT; port < PORT + PORTS; port += 1) {
    const free = await new Promise(done => {
      const probe = create_server()
      probe.on('error', () => done(false))
      probe.listen(port, '127.0.0.1', () => {
        probe.close(() => done(true))
      })
    })
    if (free) return port
  }
  throw new Error(`no free DevTools port from ${PORT}`)
}

/** Wait for the copy to answer, then report its address. */
const wait_for = async url => {
  const deadline = Date.now() + WAIT_MS
  while (Date.now() < deadline) {
    if (await answers(url)) return url
    await new Promise(done => {
      setTimeout(done, POLL_MS)
    })
  }
  throw new Error(`no Chrome on ${url} after ${WAIT_MS}ms`)
}

const { devtools_cookies } = await import(`${LIB}/src/halo/cookie-jar.js`)

const lease = async () => {
  const current = held()
  if (current && (await answers(current.url))) {
    process.stdout.write(`${current.url}\n`)
    process.stderr.write(`until ${current.expires}\n`)
    return
  }
  if (current) {
    try {
      process.kill(current.pid, 'SIGKILL')
    } catch {}
    rm_sync(lease_file, { force: true })
  }
  const port = await port_for()
  const url = `http://127.0.0.1:${port}`
  const profile = join(DIR, `realness-chrome-profile-${port}`)
  const temp = join(DIR, `realness-chrome-temp-${port}`)
  mkdir_sync(profile, { recursive: true })
  mkdir_sync(temp, { recursive: true })
  const child = spawn(
    SHELL,
    [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      'about:blank'
    ],
    { detached: true, stdio: 'ignore', env: { ...process.env, TMPDIR: temp } }
  )
  child.unref()
  await wait_for(url)
  if (site) {
    const cookies = await login_of(site, ask)
    await devtools_cookies.set(url, cookies)
  }
  const expires = new Date(Date.now() + MINUTES * MS_PER_MINUTE).toISOString()
  write_file_sync(
    lease_file,
    `${JSON.stringify({ url, pid: child.pid, site: site ?? '', expires })}\n`
  )
  process.stdout.write(`${url}\n`)
  process.stderr.write(`until ${expires}\n`)
}

const give_back = async () => {
  const current = held()
  if (!current) {
    process.stdout.write('no chrome was leased\n')
    return
  }
  if (current.site)
    await save_login(current.site, await devtools_cookies.get(current.url), ask)
  try {
    process.kill(current.pid, 'SIGKILL')
  } catch {}
  rm_sync(lease_file, { force: true })
  process.stdout.write('returned\n')
}

try {
  if (action === 'return') await give_back()
  else await lease()
} catch (error) {
  exit(`realness chrome: ${error.message}`)
}
