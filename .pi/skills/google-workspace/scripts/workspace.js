#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join, resolve } from 'node:path'
import { text } from 'node:stream/consumers'
import { OAuth2Client } from 'google-auth-library'

const state = resolve(import.meta.dirname, '../../../agent/state/google-workspace')
const credentials_path = join(state, 'credentials.json')
const tokens_dir = join(state, 'tokens')
const scopes = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets'
]

/** @param {string} email */
const token_path = email => join(tokens_dir, `${email.toLowerCase()}.json`)

/**
 * @param {string} email
 * @param {object} tokens
 */
const save = (email, tokens) => {
  mkdirSync(tokens_dir, { recursive: true })
  writeFileSync(token_path(email), JSON.stringify(tokens, null, 2), { mode: 0o600 })
}

/** @param {string} [redirect_uri] */
const oauth_client = redirect_uri => {
  if (!existsSync(credentials_path)) throw new Error(`Put the OAuth desktop client JSON at ${credentials_path}`)
  const { installed, web } = JSON.parse(readFileSync(credentials_path, 'utf8'))
  const { client_id, client_secret } = installed ?? web
  return new OAuth2Client({ clientId: client_id, clientSecret: client_secret, redirectUri: redirect_uri })
}

/** @param {string} email */
const login = async email => {
  const server = createServer()
  await new Promise(done => server.listen(0, '127.0.0.1', () => done(undefined)))
  const address = /** @type {import('node:net').AddressInfo} */ (server.address())
  const client = oauth_client(`http://127.0.0.1:${address.port}`)
  const url = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: scopes, login_hint: email })
  /** @type {Promise<string>} */
  const code = new Promise((done, fail) =>
    server.on('request', (request, response) => {
      const params = new URL(request.url ?? '/', 'http://127.0.0.1').searchParams
      response.end(params.get('code') ? 'Signed in. You can close this tab.' : 'Sign-in failed.')
      const value = params.get('code')
      if (value) done(value)
      else fail(new Error(params.get('error') ?? 'No code returned'))
    })
  )
  execFile('open', [url])
  console.error(`Opened the browser. If it did not open, visit:\n${url}`)
  const { tokens } = await client.getToken(await code).finally(() => server.close())
  client.setCredentials(tokens)
  const ticket = await client.verifyIdToken({ idToken: /** @type {string} */ (tokens.id_token) })
  const signed_in = ticket.getPayload()?.email
  if (signed_in?.toLowerCase() !== email.toLowerCase()) throw new Error(`Signed in as ${signed_in}, expected ${email}`)
  save(email, tokens)
  console.log(`Signed in ${email}`)
}

/** @param {string} email */
const authorize = email => {
  if (!existsSync(token_path(email)))
    throw new Error(
      `No token for ${email}. Run: node .pi/skills/google-workspace/scripts/workspace.js login --email ${email}`
    )
  const client = oauth_client()
  client.setCredentials(JSON.parse(readFileSync(token_path(email), 'utf8')))
  client.on('tokens', tokens => save(email, { ...client.credentials, ...tokens }))
  return client
}

/** @param {string} email */
const exec = async email => {
  const auth = authorize(email)
  /**
   * @param {string} url
   * @param {{ method?: string, params?: object, data?: object }} [options]
   */
  const call = async (url, options = {}) => (await auth.request({ url, ...options })).data
  const source = await text(process.stdin)
  const run = new (async () => {}).constructor('call', 'auth', source)
  console.log(JSON.stringify(await run(call, auth), null, 2))
}

const accounts = () => {
  const files = existsSync(tokens_dir) ? readdirSync(tokens_dir) : []
  console.log(files.map(file => file.replace(/\.json$/, '')).join('\n') || 'No accounts. Run login --email <address>.')
}

const [command, flag, email] = process.argv.slice(2)
if (command === 'accounts') accounts()
else if (flag !== '--email' || !email)
  throw new Error('Usage: workspace.js login|exec --email <address>, or workspace.js accounts')
else if (command === 'login') await login(email)
else if (command === 'exec') await exec(email)
else throw new Error(`Unknown command ${command}`)
