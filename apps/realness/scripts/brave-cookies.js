#!/usr/bin/env node
/**
 * Read one site's cookies out of Scott's own Brave, so the halo jar fills
 * without a second browser or a password.
 *
 *     node scripts/brave-cookies.js --domain workatastartup.com \
 *       --json /tmp/yc-cookies.json
 *
 * Brave keeps its cookies in an encrypted SQLite table, and the key sits in
 * the login Keychain, so one Keychain prompt is the whole ask.
 */
import { execFile as exec_file } from 'node:child_process'
import {
  createDecipheriv as create_decipheriv,
  createHash as create_hash,
  pbkdf2Sync as pbkdf2_sync
} from 'node:crypto'
import {
  copyFile as copy_file,
  mkdtemp,
  rm,
  writeFile as write_file
} from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { promisify } from 'node:util'
import { under } from './cookie-import.js'
import { run_entry } from './lib/entry.js'

/** Chromium's macOS key derivation: SHA-1, 1003 rounds, a 16-byte key. */
const SALT = 'saltysalt'
const ITERATIONS = 1003
const KEY_LENGTH = 16
/** AES-CBC wants a block of spaces for an IV, the same block every time. */
const BLOCK = 16
const IV = Buffer.alloc(BLOCK, ' ')
const CIPHER = 'aes-128-cbc'
const SAME_SITE = { 0: 'None', 1: 'Lax', 2: 'Strict' }
/** Chromium's epoch is 1601; Unix starts 11644473600 seconds later. */
const EPOCH_GAP = 11_644_473_600
const MICROSECONDS = 1_000_000
const BRAVE = 'Brave Safe Storage'
/** From database version 24, each value starts with SHA-256 of its host. */
const HASHED_FROM = 24
const HASH_BYTES = 32

/** Keys a cookie value: the login Keychain secret, round after round. */
export const key_of = secret =>
  pbkdf2_sync(secret, SALT, ITERATIONS, KEY_LENGTH, 'sha1')

/**
 * A cookie value as Brave stores it: a version tag, then AES-CBC ciphertext.
 * @param {Uint8Array} stored
 * @param {string} secret
 */
export const decrypt_value = (stored, secret, host = null) => {
  const bytes = Buffer.from(stored)
  const tag = bytes.subarray(0, 3).toString()
  if (tag !== 'v10' && tag !== 'v11')
    throw new Error(`a cookie is not v10 or v11: ${tag}`)
  const decipher = create_decipheriv(CIPHER, key_of(secret), IV)
  const plain = Buffer.concat([
    decipher.update(bytes.subarray(3)),
    decipher.final()
  ])
  if (host === null) return plain.toString('utf8')
  const hash = create_hash('sha256').update(host).digest()
  if (!plain.subarray(0, HASH_BYTES).equals(hash))
    throw new Error(`a cookie for ${host} does not carry its host hash`)
  return plain.subarray(HASH_BYTES).toString('utf8')
}

/** When a cookie expires, in seconds since the epoch; -1 for a session. */
export const expires_of = utc => {
  const micro = Number(utc ?? 0)
  return micro > 0 ? Math.round(micro / MICROSECONDS) - EPOCH_GAP : -1
}

/** One Brave row as a cookie DevTools and a jar both understand. */
export const cookie_of = (row, secret, hashed = false) => ({
  name: row.name,
  value: row.encrypted_value?.length
    ? decrypt_value(row.encrypted_value, secret, hashed ? row.host_key : null)
    : String(row.value ?? ''),
  domain: row.host_key,
  path: row.path || '/',
  expires: expires_of(row.expires_utc),
  httpOnly: Boolean(row.is_httponly),
  secure: Boolean(row.is_secure),
  ...(row.samesite in SAME_SITE
    ? { sameSite: SAME_SITE[String(row.samesite)] }
    : {})
})

/** The cookies one site holds in a Brave database, and no others. */
export const cookies_in = ({ db, domain, secret }) => {
  const base = new DatabaseSync(db, { readOnly: true })
  try {
    const rows = base
      .prepare(
        'SELECT host_key, name, value, encrypted_value, path, CAST(expires_utc AS TEXT) AS expires_utc, is_secure, is_httponly, samesite FROM cookies'
      )
      .all()
    const version = Number(
      base.prepare("SELECT value FROM meta WHERE key = 'version'").get()
        ?.value ?? 0
    )
    return rows
      .filter(row => under(row.host_key, domain))
      .map(row => cookie_of(row, secret, version >= HASHED_FROM))
  } finally {
    base.close()
  }
}

/** Where Brave keeps the default profile's cookies. */
export const brave_db = (home = homedir()) =>
  join(
    home,
    'Library/Application Support/BraveSoftware/Brave-Browser/Default/Cookies'
  )

/** The Keychain secret Brave encrypts with. One prompt, read only. */
export const brave_secret = async () => {
  const { stdout } = await promisify(exec_file)('security', [
    'find-generic-password',
    '-s',
    BRAVE,
    '-w'
  ])
  return stdout.trim()
}

/** A readable copy of a live database, its write-ahead log beside it. */
const copy_of = async db => {
  const folder = await mkdtemp(join(tmpdir(), 'brave-cookies-'))
  const copy = join(folder, 'Cookies')
  await copy_file(db, copy)
  await Promise.all(
    ['-wal', '-shm'].map(suffix =>
      copy_file(`${db}${suffix}`, `${copy}${suffix}`).catch(() => {})
    )
  )
  return { copy, folder }
}

/**
 * @param {object} [options]
 * @param {string[]} [options.args]
 * @param {() => Promise<string>} [options.secret]
 * @param {string} [options.db]
 * @param {{ write: (line: string) => void }} [options.out]
 */
export const main = async ({
  args = process.argv.slice(2),
  secret = brave_secret,
  db = brave_db(),
  out = process.stdout
} = {}) => {
  const flag = name => {
    const at = args.indexOf(`--${name}`)
    return at === -1 ? null : (args[at + 1] ?? null)
  }
  const domain = flag('domain')
  if (!domain) throw new Error('reading Brave needs --domain')
  const { copy, folder } = await copy_of(db)
  let found
  try {
    found = cookies_in({ db: copy, domain, secret: await secret() })
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
  if (!found.length) throw new Error(`no cookies for ${domain} in Brave`)
  const json = flag('json')
  if (json) await write_file(json, `${JSON.stringify(found, null, 2)}\n`)
  out.write(`${found.length} cookies for ${domain}\n`)
  return found
}

await run_entry(import.meta.url, main)
