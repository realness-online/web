/**
 * `realness login`: a sign-on handed back to the terminal.
 *
 * 1. Listen on 127.0.0.1 at a random port, with a one-time state.
 * 2. Open the sign-on page `/sign-on?cli=<port>&state=<state>` in the browser.
 * 3. After the person clicks to confirm, the page posts the refresh token to
 *    http://127.0.0.1:<port>/callback with the same state.
 * 4. Keep the refresh token in the macOS keychain; mint hourly tokens from it.
 *
 * The refresh token never touches a file or a command line.
 */
import { randomBytes as random_bytes } from 'node:crypto'
import { execFile as exec_file, spawn } from 'node:child_process'
import { createServer as create_server } from 'node:http'
import { promisify } from 'node:util'
import { HTTP } from '#root/lib/http.js'
import { MS_PER_MINUTE, MS_PER_SECOND } from '#root/lib/units.js'

const STATE_BYTES = 24
const REFRESH_MARGIN_S = 120

const SERVICE = 'realness'
const ACCOUNT = 'realness'
const WAIT = 5 * MS_PER_MINUTE

const page = message =>
  `<!doctype html><meta charset="utf-8"><title>Realness</title><p style="font:1.2rem system-ui;margin:3rem">${message}</p>`

/** The macOS keychain, driven through `security -i` so secrets stay off argv. */
export const keychain = {
  async read() {
    try {
      const { stdout } = await promisify(exec_file)('security', [
        'find-generic-password',
        '-s',
        SERVICE,
        '-a',
        ACCOUNT,
        '-w'
      ])
      return JSON.parse(stdout.trim())
    } catch {
      return null
    }
  },
  async write(value) {
    const secret = JSON.stringify(value).replace(/(["\\])/g, '\\$1')
    await run_security(
      `add-generic-password -U -s ${SERVICE} -a ${ACCOUNT} -w "${secret}"\n`
    )
  },
  async remove() {
    await run_security(
      `delete-generic-password -s ${SERVICE} -a ${ACCOUNT}\n`
    ).catch(() => {})
  }
}

/** @type {(commands: string) => Promise<void>} */
const run_security = commands =>
  new Promise((done, fail) => {
    const child = spawn('security', ['-i'], {
      stdio: ['pipe', 'ignore', 'pipe']
    })
    let errors = ''
    child.stderr.on('data', chunk => (errors += chunk))
    child.on('close', code =>
      code === 0 && !errors.trim()
        ? done()
        : fail(new Error(`keychain: ${errors.trim() || code}`))
    )
    child.stdin.end(commands)
  })

/** Trade a refresh token for a fresh ID token with Google's token endpoint. */
export const refresh = async ({ refresh_token, api_key }, fetcher = fetch) => {
  const response = await fetcher(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(api_key)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token })
    }
  )
  if (!response.ok)
    throw new Error(`refresh: ${response.status}; run realness login again`)
  const body = await response.json()
  return {
    id_token: body.id_token,
    refresh_token: body.refresh_token,
    expires_in: Number(body.expires_in)
  }
}

/**
 * Wait for the sign-on page to post the sign-in back. Resolves to the saved
 * `{ refresh_token, api_key }`; rejects on timeout.
 */
export const login = async ({
  sign_on,
  open,
  store = keychain,
  fetcher = fetch,
  wait = WAIT
}) => {
  const state = random_bytes(STATE_BYTES).toString('base64url')
  let finish
  const received = new Promise((resolve, reject) => {
    finish = { resolve, reject }
  })

  const server = create_server(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/callback')
      return response.writeHead(HTTP.NOT_FOUND).end()
    let body = ''
    for await (const chunk of request) body += chunk
    const form = new URLSearchParams(body)
    if (
      form.get('state') !== state ||
      !form.get('refresh_token') ||
      !form.get('api_key')
    ) {
      response
        .writeHead(HTTP.BAD_REQUEST, { 'content-type': 'text/html' })
        .end(page('This sign-in was not for this terminal.'))
      return
    }
    response
      .writeHead(HTTP.OK, { 'content-type': 'text/html' })
      .end(page('Realness is signed in. You can close this tab.'))
    finish.resolve({
      refresh_token: form.get('refresh_token'),
      api_key: form.get('api_key')
    })
  })
  /** @type {Promise<void>} */
  const listening = new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve())
  })
  await listening
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('the sign-on listener is not on a TCP port')
  const url = `${sign_on}/sign-on?cli=${address.port}&state=${state}`
  const timer = setTimeout(
    () => finish.reject(new Error('no sign-in within 5 minutes')),
    wait
  )

  try {
    await open(url)
    const credentials = await received
    const { id_token, refresh_token } = await refresh(credentials, fetcher)
    const saved = { refresh_token, api_key: credentials.api_key }
    await store.write(saved)
    return { ...saved, id_token }
  } finally {
    clearTimeout(timer)
    server.close()
  }
}

/** An ID token for every call: TOKEN if set, else minted from the keychain and cached. */
export const token_source = ({
  store = keychain,
  fetcher = fetch,
  env = process.env
} = {}) => {
  let cached = null
  let until = 0
  return async () => {
    if (env.TOKEN) return env.TOKEN
    if (cached && Date.now() < until) return cached
    const saved = await store.read()
    if (!saved) return null
    const fresh = await refresh(saved, fetcher)
    if (fresh.refresh_token && fresh.refresh_token !== saved.refresh_token)
      await store.write({ ...saved, refresh_token: fresh.refresh_token })

    cached = fresh.id_token
    until = Date.now() + (fresh.expires_in - REFRESH_MARGIN_S) * MS_PER_SECOND
    return cached
  }
}
