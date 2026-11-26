#!/usr/bin/env node
/**
 * s3: publish one cleaned session as a page anyone may read, and unpublish it.
 *
 * Publishing writes the session's rows as `vault/Sessions-public/<name>.html`,
 * adds a `commons` read grant for that page to `rights.html`, and uploads
 * both. Unpublishing removes the grant and the page, so the same link is
 * refused. The session itself stays in `vault/Sessions/`.
 *
 *   node .pi/bin/sessions/publish.js <session> [--remove] [--no-upload]
 *   node .pi/bin/sessions/publish.js --list
 */
import {
  existsSync as exists,
  mkdirSync as mkdir,
  readFileSync as read,
  rmSync as rm,
  writeFileSync as write
} from 'node:fs'
import { spawnSync as spawn } from 'node:child_process'
import { join } from 'node:path'
import { gunzipSync as gunzip } from 'node:zlib'
import { can, read_rights } from 'realness/can'
import { clean_text, known_secrets, OWN } from './share-clean.js'

const EMPTY = /\s*<li itemscope itemtype="https:\/\/schema\.org\/DigitalDocumentPermission">[\s\S]*?<\/li>\s*/g

/** The person this Mac belongs to, from `person.local.html`. */
export const local_phone = root => {
  for (const path of [join(root, '.pi/person.local.html'), join(root, 'person.local.html')]) {
    if (!exists(path)) continue
    const found = read(path, 'utf8').match(/href="tel:(\+\d{7,15})"/)
    if (found) return found[1]
  }
  throw new Error('No person.local.html names this Mac')
}

/** One session's rows, from the cleaned `.html.gz` file. */
export const session_rows = (root, name) => {
  const file = join(root, 'vault/Sessions', name.endsWith('.html.gz') ? name : `${name}.html.gz`)
  return gunzip(read(file)).toString('utf8')
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

/** A session's file name as a title a person reads: `25 November 2026, 17:29 UTC`. */
export const title_of = name => {
  const found = name.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})/)
  if (!found) return name.replace(/\.html\.gz$/, '')
  const [, year, month, day, hour, minute] = found
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}, ${hour}:${minute} UTC`
}

/** The stored page: a document a browser reads, around the session's rows. */
export const page_of = (rows, { name, phone }) => {
  const title = title_of(name)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<link rel="stylesheet" href="/style.css">
<style>
article { display: block; border-top: 1px solid; padding-block: 1rem; }
pre { white-space: pre-wrap; }
</style>
</head>
<body>
<main>
<h1>${title}</h1>
<p>One agent session, cleaned of secrets. <a href="/${phone}">Scott</a></p>
${rows}</main>
</body>
</html>
`
}

/** One published page: the cleaned rows a stranger may read. */
export const published_page = (root, name, phone) =>
  page_of(clean_text(session_rows(root, name), { secrets: known_secrets(root), own: OWN }), { name, phone })

/** Where one published page lives in the cloud, and the grant that names it. */
export const page_path = (phone, name) =>
  `people/${phone}/vault/Sessions-public/${name.replace(/\.html\.gz$/, '')}.html`

export const grant_about = path => `/${path.replace(/^people\//, '')}`

/** The rights page with one read grant for the commons added. */
export const add_grant = (page, path) => {
  const about = grant_about(path)
  if (read_rights(page).some(grant => grant.path === about && grant.grantee === 'commons')) return page
  const item = `<li itemscope itemtype="https://schema.org/DigitalDocumentPermission">
<p><strong>Sessions</strong> read by anyone</p>
<data itemprop="grantee" value="commons"></data>
<a itemprop="permissionType" href="https://schema.org/ReadPermission">read</a>
<a itemprop="about" href="${about}">one session</a>
</li>
`
  return page.replace(/(<\/ul>)/, `${item}$1`)
}

/** The rights page with that one grant removed, and the rest kept. */
export const remove_grant = (page, path) => {
  const about = grant_about(path)
  return page.replace(EMPTY, block =>
    read_rights(block).some(grant => grant.path === about && grant.grantee === 'commons') ? '' : block
  )
}

/** Whether anyone, signed in or not, may read a published page. */
export const readable_by_anyone = (page, path) => can(null, 'get', path, read_rights(page))

const run = argv => {
  const root = join(import.meta.dirname, '../../..')
  const phone = local_phone(root)
  const rights_file = join(root, 'rights.html')
  const published = join(root, 'vault/Sessions-public')
  mkdir(published, { recursive: true })
  const remove = argv.includes('--remove')
  const name = argv.find(arg => !arg.startsWith('-'))

  if (argv.includes('--list')) {
    const page = exists(rights_file) ? read(rights_file, 'utf8') : ''
    for (const grant of read_rights(page)) if (grant.path.includes('/vault/Sessions-public/')) console.log(grant.path)
    return 0
  }

  if (!name) {
    console.error('usage: publish.js <session> [--remove] [--no-upload] | --list')
    return 1
  }

  const path = page_path(phone, name)
  const page = read(rights_file, 'utf8')
  if (remove) {
    write(rights_file, remove_grant(page, path))
    rm(join(published, `${name.replace(/\.html\.gz$/, '')}.html`), { force: true })
  } else {
    write(join(published, `${name.replace(/\.html\.gz$/, '')}.html`), published_page(root, name, phone))
    write(rights_file, add_grant(page, path))
  }

  if (
    remove ? readable_by_anyone(read(rights_file, 'utf8'), path) : !readable_by_anyone(read(rights_file, 'utf8'), path)
  ) {
    console.error('rights.html does not hold the grant it should')
    return 1
  }

  if (!argv.includes('--no-upload')) {
    const upload = spawn(process.execPath, ['apps/realness/tools/cli/bin/realness.js', 'upload'], {
      cwd: root,
      stdio: 'inherit'
    })
    if (upload.status !== 0) return upload.status ?? 1
  }

  console.log(`${remove ? 'unpublished' : 'published'}: https://realness.online/v1/${path}`)
  return 0
}

if (process.argv[1] === import.meta.filename) process.exitCode = run(process.argv.slice(2))
