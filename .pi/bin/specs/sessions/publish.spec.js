import assert from 'node:assert/strict'
import { mkdirSync as mkdir, mkdtempSync, writeFileSync as write } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { gzipSync as gzip } from 'node:zlib'
import { read_rights } from 'realness/can'
import {
  add_grant,
  grant_about,
  local_phone,
  page_of,
  page_path,
  published_page,
  readable_by_anyone,
  remove_grant,
  session_rows,
  title_of
} from '../../sessions/publish.js'

const PHONE = '+16282281824'
const NAME = '2026-11-25T16-22-33-651Z_01a21384-17b3-73fc-acdf-db5cbab689ba'
const PATH = page_path(PHONE, NAME)
const ABOUT = grant_about(PATH)

const org_page = `<ul>
<li itemscope itemtype="https://schema.org/DigitalDocumentPermission">
<data itemprop="grantee" value="/+share-more-stories"></data>
<a itemprop="permissionType" href="https://schema.org/ReadPermission">read</a>
<a itemprop="about" href="/${PHONE}/vault/Sessions/">sessions</a>
</li>
</ul>
`

it('s3: publishing one session names it for anyone, and keeps the other grants', () => {
  assert.equal(ABOUT, `/${PHONE}/vault/Sessions-public/${NAME}.html`)
  const page = add_grant(org_page, PATH)
  assert.deepEqual(
    read_rights(page).map(grant => [grant.grantee, grant.path]),
    [
      ['/+share-more-stories', `/${PHONE}/vault/Sessions/`],
      ['commons', ABOUT]
    ]
  )
  assert.equal(readable_by_anyone(page, PATH), true)
})

it('s3: only the published session is public', () => {
  const page = add_grant(org_page, PATH)
  assert.equal(readable_by_anyone(page, `people/${PHONE}/vault/Sessions/other.html.gz`), false)
  assert.equal(readable_by_anyone(page, `people/${PHONE}/vault/Sessions-public/other.html`), false)
})

it('s3: unpublishing refuses the same link and leaves the other grants', () => {
  const page = add_grant(org_page, PATH)
  const after = remove_grant(page, PATH)
  assert.equal(readable_by_anyone(after, PATH), false)
  assert.deepEqual(read_rights(after), read_rights(org_page))
})

it('s3: publishing the same session twice holds one grant', () => {
  const once = add_grant(org_page, PATH)
  assert.equal(add_grant(once, PATH), once)
})

it('s3: the page is a document around the session rows', () => {
  const page = page_of('<article>one</article>', { name: NAME, phone: PHONE })
  assert.match(page, /^<!doctype html>/)
  assert.match(page, /<article>one<\/article>/)
  assert.ok(page.includes(`/${PHONE}`))
})

it('s3: a session name reads as a title', () => {
  assert.equal(title_of(`${NAME}.html.gz`), '25 November 2026, 16:22 UTC')
})

it('s3: the rows come from the cleaned session file', () => {
  const root = mkdtempSync(join(tmpdir(), 'publish-'))
  mkdir(join(root, 'vault/Sessions'), { recursive: true })
  write(join(root, 'vault/Sessions', `${NAME}.html.gz`), gzip('<article>key [secret]</article>\n'))
  assert.equal(session_rows(root, NAME), '<article>key [secret]</article>\n')
})

it("s3: someone else's contacts are redacted in a published page, Scott's stay", () => {
  const root = mkdtempSync(join(tmpdir(), 'publish-'))
  mkdir(join(root, 'vault/Sessions'), { recursive: true })
  write(
    join(root, 'vault/Sessions', `${NAME}.html.gz`),
    gzip('<article>jisley@lmronline.org scott@realness.online +18044905327</article>\n')
  )
  const page = published_page(root, NAME, PHONE)
  assert.ok(page.includes('[email]'))
  assert.ok(page.includes('scott@realness.online'))
  assert.ok(page.includes('[phone]'))
})

it('s3: this Mac knows its phone from person.local.html', () => {
  const root = mkdtempSync(join(tmpdir(), 'publish-'))
  mkdir(join(root, '.pi'), { recursive: true })
  write(join(root, '.pi/person.local.html'), `<a itemprop="telephone" href="tel:${PHONE}">Scott</a>`)
  assert.equal(local_phone(root), PHONE)
})
