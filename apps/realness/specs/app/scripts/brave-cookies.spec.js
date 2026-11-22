import { createCipheriv, createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vite-plus/test'
import {
  brave_db,
  cookies_in,
  decrypt_value,
  expires_of,
  key_of,
  main
} from '#root/scripts/brave-cookies.js'

const SECRET = 'a-test-secret'
const IV = Buffer.alloc(16, ' ')
/** 2029-01-01 in Unix seconds, which a Brave database counts in microseconds. */
const EXPIRES = 1_861_920_000
const EXPIRES_UTC = BigInt(EXPIRES + 11_644_473_600) * 1_000_000n

/** As Brave stores a value: from version 24, the host's hash comes first. */
const encrypt = (value, host = null) => {
  const cipher = createCipheriv('aes-128-cbc', key_of(SECRET), IV)
  const plain = host
    ? Buffer.concat([
        createHash('sha256').update(host).digest(),
        Buffer.from(value)
      ])
    : Buffer.from(value)
  return Buffer.concat([
    Buffer.from('v10'),
    cipher.update(plain),
    cipher.final()
  ])
}

const row = (host_key, name, value, samesite = 1) => [
  host_key,
  name,
  '',
  encrypt(value, host_key),
  '/',
  EXPIRES_UTC,
  1,
  1,
  samesite
]

/** A Brave-shaped cookies table, holding the rows given. */
const brave_of = async rows => {
  const folder = await mkdtemp(join(tmpdir(), 'brave-cookies-spec-'))
  const db = join(folder, 'Cookies')
  const base = new DatabaseSync(db)
  base.exec(`CREATE TABLE cookies (
    host_key TEXT, name TEXT, value TEXT, encrypted_value BLOB, path TEXT,
    expires_utc INTEGER, is_secure INTEGER, is_httponly INTEGER, samesite INTEGER
  )`)
  base.exec(`CREATE TABLE meta (key TEXT, value TEXT);
    INSERT INTO meta VALUES ('version', '24')`)
  const insert = base.prepare('INSERT INTO cookies VALUES (?,?,?,?,?,?,?,?,?)')
  for (const found of rows) insert.run(...found)
  base.close()
  return { db, folder }
}

const lines = () => {
  const written = []
  return { written, write: line => written.push(line) }
}

describe('brave cookies', () => {
  it('a stored value comes back with the Keychain secret', () => {
    expect(decrypt_value(encrypt('abc'), SECRET)).toBe('abc')
    expect(() => decrypt_value(Buffer.from('v09xx'), SECRET)).toThrow(/not v10/)
  })

  it('a session cookie has no expiry, and a dated one counts from 1601', () => {
    expect(expires_of(0)).toBe(-1)
    expect(expires_of(String(EXPIRES_UTC))).toBe(EXPIRES)
  })

  it('a version 24 value drops its host hash, so the value is the cookie itself', () => {
    const stored = encrypt('abc', '.workatastartup.com')
    expect(decrypt_value(stored, SECRET, '.workatastartup.com')).toBe('abc')
    expect(() => decrypt_value(stored, SECRET, '.other.com')).toThrow(
      /does not carry its host hash/
    )
  })

  it("reads one site's cookies, and no other site's", async () => {
    const { db, folder } = await brave_of([
      row('.workatastartup.com', '_sso.key', 'secret'),
      row('news.ycombinator.com', 'user', 'scott')
    ])
    const found = cookies_in({
      db,
      domain: 'workatastartup.com',
      secret: SECRET
    })
    expect(found).toEqual([
      {
        name: '_sso.key',
        value: 'secret',
        domain: '.workatastartup.com',
        path: '/',
        expires: EXPIRES,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax'
      }
    ])
    await rm(folder, { recursive: true })
  })

  it('the cookies a run needs go to the JSON file a jar import reads', async () => {
    const { db, folder } = await brave_of([
      row('.workatastartup.com', '_sso.key', 'secret')
    ])
    const json = join(folder, 'cookies.json')
    const out = lines()
    await main({
      db,
      secret: async () => SECRET,
      args: ['--domain', 'workatastartup.com', '--json', json],
      out
    })
    expect(JSON.parse(await readFile(json, 'utf8'))).toHaveLength(1)
    expect(out.written).toEqual(['1 cookies for workatastartup.com\n'])
    await rm(folder, { recursive: true })
  })

  it('a signed-out Brave leaves no jar, so it names the site it lacks', async () => {
    const { db, folder } = await brave_of([
      row('news.ycombinator.com', 'u', 'v')
    ])
    await expect(
      main({
        db,
        secret: async () => SECRET,
        args: ['--domain', 'workatastartup.com'],
        out: lines()
      })
    ).rejects.toThrow(/no cookies for workatastartup.com in Brave/)
    await rm(folder, { recursive: true })
  })

  it('the database it reads is the default profile of Brave', () => {
    expect(brave_db('/home/person')).toBe(
      '/home/person/Library/Application Support/BraveSoftware/Brave-Browser/Default/Cookies'
    )
  })
})
