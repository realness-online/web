#!/usr/bin/env node
/**
 * s2: a session is cleaned where pi writes it, so one copy exists and a
 * secret never leaves the Mac. Known secrets and key shapes become
 * `[secret]`; outside emails and phones stay until a session is shared.
 *
 *   node .pi/bin/sessions/share-clean.js [--dry-run]
 */
import {
  existsSync as exists,
  readFileSync as read,
  readdirSync as list,
  renameSync as rename,
  statSync as stat,
  writeFileSync as write
} from 'node:fs'
import { randomUUID as random_uuid } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync as gunzip, gzipSync as gzip } from 'node:zlib'

const SECRET = '[secret]'
const SHORTEST = 12

/** Key shapes, after gitleaks and TruffleHog detectors. */
export const KEY_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[^<"]*/g,
  /\bsk-ant-[A-Za-z0-9_-]{20,}/g,
  /\bsk-or-v1-[a-f0-9]{40,}/g,
  /\bsk-proj-[A-Za-z0-9_-]{20,}/g,
  /\bsk-(?:svcacct|admin)-[A-Za-z0-9_-]{20,}/g,
  /\bsk-[A-Za-z0-9]{32,}/g,
  /\bAIza[0-9A-Za-z_-]{35}/g,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{30,}/g,
  /\bxox[abposr]-[A-Za-z0-9-]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/g,
  /\bya29\.[A-Za-z0-9_-]{30,}/g,
  /\b1\/\/0[A-Za-z0-9_-]{30,}/g
]

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const PHONE = /\+1[2-9]\d{9}\b/g

/** A variable name that holds a secret, as `.secrets.zsh` and `.env` files name them. */
const SECRET_NAME = /KEY|TOKEN|SECRET|PASS|CREDENTIAL|PRIVATE|AUTH/

/** Scott's own contacts, which a shared session keeps. */
export const OWN = {
  emails: ['scott@realness.online'],
  phones: ['+16282281824']
}

/**
 * The values of secret-named variables in an env file or a shell secrets file.
 * `GCLOUD_PROJECT=realness-online` names a project, so it stays readable.
 * @param {string} text
 * @returns {string[]}
 */
export const env_secrets = text =>
  [...text.matchAll(/^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.+)$/gm)]
    .filter(([, name]) => SECRET_NAME.test(name))
    .map(([, , value]) => value)

/**
 * Secret values this machine knows: env files, the shell secrets file, the
 * agent's secret files, and secret-named variables of this process.
 * @param {string} root
 * @returns {string[]}
 */
export const known_secrets = root => {
  const values = new Set()
  const add = value => {
    const clean = String(value ?? '')
      .trim()
      .replace(/^['"]|['"]$/g, '')
    if (clean.length >= SHORTEST && !/\s/.test(clean)) values.add(clean)
  }
  const env_lines = file => {
    if (!exists(file)) return
    for (const value of env_secrets(read(file, 'utf8'))) add(value)
  }
  for (const app of ['apps/realness', 'apps/realness/functions', 'apps/seeq-app'])
    for (const name of exists(join(root, app)) ? list(join(root, app)) : [])
      if (/^\.env\..*local$|^\.env\.(?!example)/.test(name)) env_lines(join(root, app, name))
  env_lines(join(homedir(), '.secrets.zsh'))
  const secrets = join(root, '.pi/agent/secrets')
  for (const name of exists(secrets) ? list(secrets) : []) {
    const file = join(secrets, name)
    if (stat(file).isFile()) add(read(file, 'utf8'))
  }
  for (const [name, value] of Object.entries(process.env)) if (/KEY|TOKEN|SECRET|PASS/.test(name)) add(value)
  return [...values].sort((a, b) => b.length - a.length)
}

/**
 * Secrets only, for a session kept on this machine: known values and key
 * shapes. Contacts stay.
 * @param {string} text
 * @param {string[]} secrets
 */
export const clean_secrets = (text, secrets) => {
  let clean = text
  for (const secret of secrets) clean = clean.split(secret).join(SECRET)
  for (const pattern of KEY_PATTERNS) clean = clean.replace(pattern, SECRET)
  return clean
}

/**
 * Everything, for a session anyone may read. Own contacts stay; others
 * become `[email]` and `[phone]`.
 * @param {string} text
 * @param {{ secrets: string[], own?: { emails: string[], phones: string[] } }} with
 */
export const clean_text = (text, { secrets, own = OWN }) => {
  let clean = clean_secrets(text, secrets)
  clean = clean.replace(EMAIL, email => (own.emails.includes(email.toLowerCase()) ? email : '[email]'))
  return clean.replace(PHONE, phone => (own.phones.includes(phone) ? phone : '[phone]'))
}

/**
 * Key shapes still in a cleaned text; a session with any is held.
 * @param {string} text
 */
export const left_keys = text =>
  KEY_PATTERNS.flatMap(pattern => text.match(pattern) ?? []).filter(found => found !== SECRET)

/**
 * Clean one session file in place, atomically. `cleaned`, `unchanged`, or
 * `held` when a key shape survived.
 * @param {string} path
 * @param {{ secrets: string[], dry_run?: boolean }} with
 * @returns {'cleaned' | 'unchanged' | 'held'}
 */
export const clean_file = (path, { secrets, dry_run = false }) => {
  const text = gunzip(read(path)).toString('utf8')
  const clean = clean_secrets(text, secrets)
  if (clean === text) return 'unchanged'
  if (left_keys(clean).length) return 'held'
  if (dry_run) return 'cleaned'
  const temporary = `${path}.cleaning-${random_uuid()}`
  write(temporary, gzip(clean), { flag: 'wx', mode: 0o600 })
  rename(temporary, path)
  return 'cleaned'
}

/**
 * Clean every session in `vault/Sessions/`, in place. No second copy.
 * @param {string} root
 * @param {{ dry_run?: boolean }} options
 */
export const clean_sessions = (root, { dry_run = false } = {}) => {
  const folder = join(root, 'vault/Sessions')
  const secrets = known_secrets(root)
  const files = exists(folder) ? list(folder).filter(name => name.endsWith('.html.gz')) : []
  const tally = { cleaned: 0, unchanged: 0, held: [], secrets: secrets.length }
  for (const name of files) {
    const result = clean_file(join(folder, name), { secrets, dry_run })
    if (result === 'held') tally.held.push(name)
    else tally[result]++
  }
  return tally
}

const run = () => {
  const root = join(import.meta.dirname, '../../..')
  const tally = clean_sessions(root, { dry_run: process.argv.includes('--dry-run') })
  console.log(
    `${tally.cleaned} cleaned, ${tally.unchanged} unchanged, ${tally.held.length} held, ${tally.secrets} known secrets${process.argv.includes('--dry-run') ? ' (dry run)' : ''}`
  )
  for (const name of tally.held) console.log(`held: ${name}`)
}

if (process.argv[1] === import.meta.filename) run()
