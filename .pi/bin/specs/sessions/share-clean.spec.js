import assert from 'node:assert/strict'
import { existsSync as exists, mkdirSync as mkdir, mkdtempSync, readFileSync, writeFileSync as write } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { gunzipSync as gunzip, gzipSync as gzip } from 'node:zlib'
import { clean_sessions, clean_text, env_secrets, known_secrets, left_keys } from '../../sessions/share-clean.js'

const own = { emails: ['scott@realness.online'], phones: ['+16282281824'] }

/** A root with one session that holds a secret, an own email, and an outside email. */
const vault_root = () => {
  const root = mkdtempSync(join(tmpdir(), 'share-clean-'))
  const sessions = join(root, 'vault/Sessions')
  mkdir(sessions, { recursive: true })
  write(
    join(sessions, 'one.html.gz'),
    gzip('<p>key sk-ant-' + 'a'.repeat(40) + ' scott@realness.online jisley@lmronline.org</p>\n')
  )
  return { root, file: join(sessions, 'one.html.gz') }
}

const text_of = file => gunzip(readFileSync(file)).toString('utf8')

it('s1: a known secret is replaced exactly, wherever it appears', () => {
  const secret = 'plain-looking-value-1234'
  const text = `token: ${secret} and again "${secret}"`
  const clean = clean_text(text, { secrets: [secret], own })
  assert.equal(clean.includes(secret), false)
  assert.equal(clean, 'token: [secret] and again "[secret]"')
})

it('s1: key shapes are replaced, and none are left', () => {
  const keys = [
    `sk-ant-api03-${'a'.repeat(40)}`,
    `sk-or-v1-${'0'.repeat(64)}`,
    `sk-svcacct-${'V'.repeat(40)}`,
    `AIzaSy${'B'.repeat(33)}`,
    `ghp_${'c'.repeat(36)}`,
    `-----BEGIN PRIVATE KEY-----\nMIIE${'x'.repeat(40)}\n-----END PRIVATE KEY-----`
  ]
  const clean = clean_text(keys.join('\n'), { secrets: [], own })
  assert.deepEqual(left_keys(clean), [])
  for (const key of keys) assert.equal(clean.includes(key), false)
})

it('s1: outside emails and phones go; Scott keeps his own', () => {
  const text = 'jisley@lmronline.org +18044905327 scott@realness.online /+16282281824/plans/1'
  assert.equal(clean_text(text, { secrets: [], own }), '[email] [phone] scott@realness.online /+16282281824/plans/1')
})

it('s1: a key shape the cleaner missed is found, so the session is held', () => {
  assert.equal(left_keys(`see sk-ant-${'z'.repeat(30)}`).length, 1)
})

it('s1: an env file gives only its secret-named values', () => {
  const text = [
    'GCLOUD_PROJECT=realness-online',
    'VITE_FIREBASE_PROJECT_ID=realness-development',
    'export OPENAI_API_KEY=plain-looking-value-1234',
    'CLOUDFLARE_TOKEN=another-value-5678'
  ].join('\n')
  assert.deepEqual(env_secrets(text), ['plain-looking-value-1234', 'another-value-5678'])
})

it('s2: a session is cleaned where it sits, and no second copy is made', () => {
  const { root, file } = vault_root()
  const tally = clean_sessions(root)
  assert.equal(tally.cleaned, 1)
  assert.equal(text_of(file).includes('sk-ant-'), false)
  assert.equal(text_of(file), '<p>key [secret] scott@realness.online jisley@lmronline.org</p>\n')
  assert.equal(exists(join(root, 'vault/Sessions-shared')), false)
})

it('s2: a cleaned session is left alone the next time', () => {
  const { root, file } = vault_root()
  clean_sessions(root)
  const bytes = readFileSync(file)
  const tally = clean_sessions(root)
  assert.deepEqual(tally, { cleaned: 0, unchanged: 1, held: [], secrets: tally.secrets })
  assert.deepEqual(readFileSync(file), bytes)
})

it('s1: an ordinary .env value stays readable in a cleaned session', () => {
  const root = mkdtempSync(join(tmpdir(), 'share-clean-'))
  mkdir(join(root, 'apps/realness'), { recursive: true })
  write(
    join(root, 'apps/realness/.env.production'),
    'GCLOUD_PROJECT=realness-online\nOPENAI_API_KEY=plain-looking-value-1234\n'
  )
  const secrets = known_secrets(root)
  assert.equal(secrets.includes('realness-online'), false)
  assert.equal(secrets.includes('plain-looking-value-1234'), true)
  const clean = clean_text('project realness-online, key plain-looking-value-1234', { secrets, own })
  assert.equal(clean, 'project realness-online, key [secret]')
})
