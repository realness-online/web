/**
 * Give every person in the phonebook the two small files the app expects them
 * to have: a root profile, and a statements file.
 *
 * Operator CLI (not a Cloud Function). Uses gcloud, so it writes with project
 * credentials rather than a phone-number token - storage rules only let a person
 * write their own files, and these people are missing theirs.
 *
 * Sign-up used to leave nothing at a person's root until they edited their name,
 * and a person who never wrote a thought had no statements file at all. Both are
 * fixed in the app now; this repairs the accounts that predate the fix.
 *
 * Usage (from work/realness-ops):
 *   npm run repair                 # report only, writes nothing
 *   npm run repair -- --write      # create the missing files
 *   npm run repair -- --only +14155550101
 */
import { spawnSync as spawn_sync } from 'node:child_process'
import { createHash as create_hash } from 'node:crypto'
import { gzipSync as gzip_sync } from 'node:zlib'
import { mkdtempSync as mkdtemp_sync, writeFileSync as write_file_sync, rmSync as rm_sync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const default_project = 'realness-online'
const default_locale = 'en'
/** Matches `prepare_upload_html` in the web app. Both files are read through it. */
const cache_control = 'private, max-age=18000'
const content_type = 'text/html; charset=utf-8'
const content_encoding = 'gzip'
const content_disposition = 'inline'
/** pako's `gzip({ level: 9 })` in the browser worker writes the same format. */
const gzip_level = 9

/**
 * The app hashes the html string, not the compressed bytes, and stores it in
 * `customMetadata.hash`. Sync compares that against a hash of the local copy, so
 * a wrong hash here means every client re-downloads the file on every tick.
 * @param {string} html
 * @returns {string}
 */
export const content_hash = html =>
  create_hash('sha256').update(html, 'utf8').digest('base64')

/**
 * @param {string} e64 Phone number as the storage prefix names it, e.g. `+14155550101`
 * @returns {string}
 */
export const profile_html = e64 =>
  `<address itemscope itemtype="/person" itemid="/${e64}"><header><h3 itemprop="name"></h3></header></address>`

/**
 * An empty feed. Reads back as a person with nothing to say.
 * @param {string} e64
 * @returns {string}
 */
export const statements_html = e64 =>
  `<section itemscope itemid="/${e64}/statements" data-days role="feed"></section>`

/**
 * @param {string} e64
 * @returns {{ profile: string, statements: string }}
 */
export const paths_for = e64 => ({
  profile: `people/${e64}/index.html`,
  statements: `people/${e64}/statements/index.html`
})

/**
 * @param {string} html
 * @returns {Buffer}
 */
export const compress = html =>
  gzip_sync(Buffer.from(html, 'utf8'), { level: gzip_level })

/**
 * @param {string} html
 * @param {string} [locale]
 * @returns {Record<string, string>}
 */
export const metadata_for = (html, locale = default_locale) => ({
  'Cache-Control': cache_control,
  'Content-Type': content_type,
  'Content-Encoding': content_encoding,
  'Content-Disposition': content_disposition,
  'Content-Language': locale,
  hash: content_hash(html),
  fullLocale: locale
})

/**
 * Turn a `gcloud storage ls` listing into what each person is missing.
 * @param {string} e64
 * @param {string[]} listed Object and prefix names under `people/{e64}/`
 * @returns {{ e64: string, profile: boolean, statements: boolean }}
 */
export const missing_for = (e64, listed) => {
  const { profile, statements } = paths_for(e64)
  const has = new Set(listed)
  return {
    e64,
    profile: !has.has(profile),
    statements: !has.has(statements)
  }
}

/**
 * @param {string} name A `gs://bucket/people/+1555.../` prefix from a listing
 * @returns {string | null}
 */
export const e64_from_prefix = name => {
  const match = /people\/(\+[0-9]+)\/?$/.exec(name.trim())
  return match ? match[1] : null
}

/**
 * @param {string[]} args
 * @returns {string[]} stdout lines
 */
const gcloud = args => {
  const result = spawn_sync('gcloud', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
  if (result.error) {
    if (/** @type {NodeJS.ErrnoException} */ (result.error).code === 'ENOENT')
      throw new Error(
        'gcloud not found. Install Google Cloud SDK and run gcloud auth login.'
      )
    throw result.error
  }
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim()
    if (/One or more URLs matched no objects/i.test(err)) return []
    throw new Error(err || `gcloud exited with status ${result.status}`)
  }
  return (result.stdout || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

/**
 * @param {string} bucket
 * @param {string} pattern Prefix or glob under the bucket
 * @returns {string[]} Object paths relative to the bucket
 */
const list = (bucket, pattern) =>
  gcloud(['storage', 'ls', `gs://${bucket}/${pattern}`])
    .map(line => line.replace(`gs://${bucket}/`, ''))
    .filter(Boolean)

/**
 * @param {string} bucket
 * @param {string} object_path
 * @param {string} html
 * @param {string} locale
 */
const upload = (bucket, object_path, html, locale) => {
  const meta = metadata_for(html, locale)
  const meta_hash = meta.hash
  const dir = mkdtemp_sync(path.join(tmpdir(), 'repair-people-'))
  const local = path.join(dir, 'index.html')
  try {
    write_file_sync(local, compress(html))
    gcloud([
      'storage',
      'cp',
      local,
      `gs://${bucket}/${object_path}`,
      `--cache-control=${meta['Cache-Control']}`,
      `--content-type=${meta['Content-Type']}`,
      `--content-encoding=${meta['Content-Encoding']}`,
      `--content-disposition=${meta['Content-Disposition']}`,
      `--content-language=${meta['Content-Language']}`,
      `--custom-metadata=hash=${meta.hash},fullLocale=${meta.fullLocale}`
    ])
  } finally {
    rm_sync(dir, { recursive: true, force: true })
  }
  const landed = gcloud([
    'storage',
    'objects',
    'describe',
    `gs://${bucket}/${object_path}`,
    '--format=value(metadata.hash)'
  ])
  const written = landed[0]
  if (written !== meta_hash)
    throw new Error(
      `${object_path} wrote but reads back with hash ${written || '(none)'}, expected ${meta_hash}`
    )
}

const usage = `usage: npm run repair -- [--write] [--only +1555...] [--project id]

  --write       create the missing files (default: report only)
  --only E164   just this person, repeatable
  --project id  firebase project (default: ${default_project})`

/**
 * @param {string[]} args
 * @returns {{ write: boolean, project: string, only: string[] }}
 */
export const parse_args = args => {
  const value_after = flag => {
    const at = args.indexOf(flag)
    return at === -1 ? null : (args[at + 1] ?? null)
  }
  const only = args.reduce((found, arg, index) => {
    if (arg === '--only' && args[index + 1]) found.push(args[index + 1])
    return found
  }, /** @type {string[]} */ ([]))
  const bad = only.filter(e64 => !/^\+[0-9]+$/.test(e64))
  if (bad.length)
    throw new Error(
      `--only wants a full E.164 number like +14155550101, got ${bad.join(', ')}`
    )
  return {
    write: args.includes('--write'),
    project: value_after('--project') ?? default_project,
    only
  }
}

const main = () => {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage)
    return
  }
  const { write, project, only } = parse_args(args)
  const bucket = `${project}.appspot.com`

  const people = only.length
    ? only
    : list(bucket, 'people/')
        .map(e64_from_prefix)
        .filter(/** @returns {name is string} */ name => Boolean(name))

  const listed = [
    ...list(bucket, 'people/*/index.html'),
    ...list(bucket, 'people/*/statements/index.html')
  ]

  console.log(
    `${people.length} people in gs://${bucket}/people/${write ? '' : ' (dry run)'}`
  )

  let repaired = 0
  for (const e64 of people) {
    const missing = missing_for(e64, listed)
    if (!missing.profile && !missing.statements) continue
    repaired++

    const wants = [
      missing.profile ? 'profile' : null,
      missing.statements ? 'statements' : null
    ]
      .filter(Boolean)
      .join(' + ')
    console.log(`  ${e64}  missing ${wants}`)

    if (!write) continue
    const { profile, statements } = paths_for(e64)
    if (missing.profile)
      upload(bucket, profile, profile_html(e64), default_locale)
    if (missing.statements)
      upload(bucket, statements, statements_html(e64), default_locale)
  }

  if (!repaired) console.log('  nothing to repair')
  else if (!write)
    console.log(`\n${repaired} to repair. Re-run with --write to create them.`)
  else console.log(`\nrepaired ${repaired}`)
}

if (process.argv[1] && process.argv[1].endsWith('repair-people.js')) main()
