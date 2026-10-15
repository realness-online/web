import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import { test } from 'node:test'
import {
  compress,
  content_hash,
  e64_from_prefix,
  metadata_for,
  missing_for,
  parse_args,
  paths_for,
  profile_html,
  statements_html
} from '../../tools/ops/repair-people.js'

const PHONE = '+14155550101'

test('the profile it writes matches what the app reads', () => {
  const html = profile_html(PHONE)
  assert.match(html, /itemtype="\/person"/)
  assert.match(html, new RegExp(`itemid="/\\${PHONE}"`))
  assert.match(html, /itemprop="name"/)
})

test('the statements file it writes is an empty feed', () => {
  const html = statements_html(PHONE)
  assert.match(html, /itemid="\/\+14155550101\/statements"/)
  assert.match(html, /role="feed"/)
})

test('the hash covers the html, which is what sync compares', () => {
  const html = profile_html(PHONE)
  assert.equal(content_hash(html), content_hash(html))
  assert.notEqual(content_hash(html), content_hash(statements_html(PHONE)))
  assert.match(content_hash(html), /^[A-Za-z0-9+/=]+$/)
})

test('the object paths sit under the person and end in index.html', () => {
  assert.deepEqual(paths_for(PHONE), {
    profile: `people/${PHONE}/index.html`,
    statements: `people/${PHONE}/statements/index.html`
  })
})

test('the compressed bytes are gzip that reads back as the same html', () => {
  const html = profile_html(PHONE)
  const bytes = compress(html)
  assert.equal(gunzipSync(bytes).toString('utf8'), html)
  assert.equal(bytes[0], 0x1f)
  assert.equal(bytes[1], 0x8b)
})

test('the metadata names the encoding, cache, and hash the app checks', () => {
  const html = profile_html(PHONE)
  const metadata = metadata_for(html, 'fr')
  assert.equal(metadata['Content-Encoding'], 'gzip')
  assert.equal(metadata['Content-Type'], 'text/html; charset=utf-8')
  assert.equal(metadata['Cache-Control'], 'private, max-age=18000')
  assert.equal(metadata['Content-Language'], 'fr')
  assert.equal(metadata.fullLocale, 'fr')
  assert.equal(metadata.hash, content_hash(html))
  assert.equal(metadata_for(html).fullLocale, 'en')
})

test('missing_for reads .html names; a retired .gz copy is not present', () => {
  assert.deepEqual(missing_for(PHONE, []), {
    e64: PHONE,
    profile: true,
    statements: true
  })
  assert.deepEqual(missing_for(PHONE, [`people/${PHONE}/index.html.gz`]), {
    e64: PHONE,
    profile: true,
    statements: true
  })
  assert.deepEqual(missing_for(PHONE, [`people/${PHONE}/index.html`]), {
    e64: PHONE,
    profile: false,
    statements: true
  })
  assert.deepEqual(
    missing_for(PHONE, [
      `people/${PHONE}/index.html`,
      `people/${PHONE}/statements/index.html`
    ]),
    { e64: PHONE, profile: false, statements: false }
  )
  assert.deepEqual(missing_for(PHONE, [`people/+19999999999/index.html`]), {
    e64: PHONE,
    profile: true,
    statements: true
  })
})

test('e64_from_prefix reads a phone prefix and refuses anything else', () => {
  assert.equal(e64_from_prefix(`gs://bucket/people/${PHONE}/`), PHONE)
  assert.equal(e64_from_prefix(`people/${PHONE}/`), PHONE)
  assert.equal(e64_from_prefix('gs://bucket/people/not-a-phone/'), null)
  assert.equal(e64_from_prefix(''), null)
  assert.equal(e64_from_prefix('gs://bucket/admins.html'), null)
})

test('parse_args reads --write and --only, and defaults to a report', () => {
  assert.deepEqual(parse_args([]), {
    write: false,
    only: [],
    project: 'realness-online'
  })
  assert.deepEqual(parse_args(['--write']), {
    write: true,
    only: [],
    project: 'realness-online'
  })
  assert.deepEqual(parse_args(['--only', PHONE]), {
    write: false,
    only: [PHONE],
    project: 'realness-online'
  })
  assert.deepEqual(parse_args(['--project', 'other']), {
    write: false,
    only: [],
    project: 'other'
  })
})
