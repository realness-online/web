/**
 * What a deployed service was built from. Staging writes `release.json` into
 * the image: the version and a bundle hash over every staged file. The
 * service answers it at `GET /v1/release`, and verify stages the tagged
 * source again and compares, so a pass means the running bytes are the tag's.
 */
import { createHash as create_hash } from 'node:crypto'
import {
  readFileSync as read_file_sync,
  readdirSync as readdir_sync
} from 'node:fs'
import { join, relative, sep } from 'node:path'

export const RELEASE_FILE = 'release.json'
const RELEASE_PATH = '/v1/release'

const sha256 = bytes => create_hash('sha256').update(bytes).digest('hex')

/** Every file under `dir` but the stamp itself, as sorted `/`-paths. */
const files_in = dir =>
  readdir_sync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry =>
      relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/')
    )
    .filter(path => path !== RELEASE_FILE)
    .sort()

/** One hash for a staged folder: the same files and bytes give the same hash. */
export const bundle_of = dir =>
  sha256(
    files_in(dir)
      .map(path => `${path}\0${sha256(read_file_sync(join(dir, path)))}\n`)
      .join('')
  )

/** The stamp for a staged folder. */
export const stamp_of = dir => ({
  version: JSON.parse(read_file_sync(join(dir, 'package.json'), 'utf8'))
    .version,
  bundle: bundle_of(dir)
})

/** The running service's stamp, read once; null when it was not staged. */
let served
const served_stamp = () => {
  if (served !== undefined) return served
  try {
    served = read_file_sync(join(process.cwd(), RELEASE_FILE), 'utf8')
  } catch {
    served = null
  }
  return served
}

/**
 * Answer `GET /v1/release` when this is that request; true when answered.
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 */
export const answer_release = (request, response) => {
  const path = new URL(request.url ?? '/', 'http://service').pathname
  if (request.method !== 'GET' || path !== RELEASE_PATH) return false
  const body = served_stamp()
  response.writeHead(body ? 200 : 404, {
    'content-type': 'application/json',
    'cache-control': 'no-store'
  })
  response.end(body ?? '{"error":"not staged"}\n')
  return true
}
