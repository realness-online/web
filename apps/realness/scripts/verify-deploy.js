import { createHash as create_hash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { is_release_junk } from './release-junk.js'
import { run_entry } from './lib/entry.js'
import { frontend_out, out_path } from '#root/src/settings/output.js'

const default_repo = 'realness-online/web'
const SERVICES = ['sync', 'proxy', 'gate']
const STAGED_WITH_ENVIRONMENT = ['gate']
const default_url = 'https://realness.online'
const manifest_asset = 'build-manifest.json'
const script_path = file_url_to_path(import.meta.url)

const help_text = `Verify a live Realness instance against a GitHub release manifesto.

GitHub is the root of trust: the site alone can rewrite files and its own
manifesto together. A pass means live bytes match a published release asset.

Usage:
  npm run verify
  npm run verify -- --url https://community.example
  npm run verify -- --release 2.5.8

Options:
  --url URL           Instance to check (default: ${default_url})
  --release [tag]     GitHub release (default: latest that has ${manifest_asset})
                      Bare --release uses package.json version
  --repo owner/name   GitHub repo (default: ${default_repo})
  --manifest PATH     Local build-manifest.json (operator / deploy gate)
  --from-site         Instance's own manifesto only (not independent evidence)
  --settle SECONDS    Re-check failures until they match or time runs out
                      (a CDN or a new revision can lag a deploy)
  --services [list]   Check services (default sync,proxy,gate) run this
                      checkout's staged bytes
  --help              Show this help

Operators: after deploy, attach the same dist manifesto to the release:
  npm run release:gh
`

export const parse_args = (argv = process.argv.slice(2)) => {
  const args = [...argv]
  if (args.includes('--help') || args.includes('-h')) return { help: true }

  let base_url = default_url
  let manifest_path = null
  let release = null
  let from_site = false
  let repo = default_repo
  let settle = 0
  let services = null

  for (let i = 0; i < args.length; i++)
    if (args[i] === '--url' && args[i + 1]) base_url = args[++i]
    else if (args[i] === '--manifest' && args[i + 1]) manifest_path = args[++i]
    else if (args[i] === '--repo' && args[i + 1]) repo = args[++i]
    else if (args[i] === '--from-site') from_site = true
    else if (args[i] === '--settle' && args[i + 1]) settle = Number(args[++i])
    else if (args[i] === '--services')
      services =
        args[i + 1] && !args[i + 1].startsWith('--')
          ? args[++i].split(',')
          : SERVICES
    else if (args[i] === '--release') {
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        release = args[++i]
        continue
      }
      release = 'package'
    }

  if (!manifest_path && !release && !from_site) release = 'latest'

  return {
    base_url: base_url.replace(/\/$/, ''),
    manifest_path,
    release,
    from_site,
    repo,
    settle,
    services
  }
}

/** @param {ArrayBuffer | Buffer | string} bytes */
const sha256_bytes = bytes =>
  `sha256:${create_hash('sha256').update(Buffer.from(bytes)).digest('hex')}`

/** @param {string} tag */
export const release_tag_candidates = tag => {
  const bare = tag.replace(/^v/, '')
  return [...new Set([tag, bare, `v${bare}`])]
}

const package_version = () => {
  const package_path = path.join(
    path.dirname(script_path),
    '..',
    'package.json'
  )
  return JSON.parse(fs.readFileSync(package_path, 'utf8')).version
}

/**
 * @param {string} repo
 * @param {string} tag
 */
export const github_download_url = (repo, tag) =>
  `https://github.com/${repo}/releases/download/${tag}/${manifest_asset}`

/**
 * @param {string} repo
 * @returns {Promise<string>}
 */
const latest_release_tag_with_manifest = async repo => {
  const url = `https://api.github.com/repos/${repo}/releases?per_page=30`
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json' }
  })
  if (!response.ok) throw new Error(`GitHub API ${response.status} for ${url}`)

  const releases = await response.json()
  for (const entry of releases) {
    const has_manifest = (entry.assets ?? []).some(
      asset => asset.name === manifest_asset
    )
    if (has_manifest) return entry.tag_name
  }

  throw new Error(
    `No GitHub release on ${repo} has a ${manifest_asset} asset yet.\n` +
      `Operators: deploy from dist/, then publish that same manifesto:\n` +
      `  npm run release:gh\n` +
      `Or: gh release upload <tag> "${frontend_out(manifest_asset)}"`
  )
}

/**
 * @param {{ repo: string, release: string }} opts
 */
const resolve_release_tag = async (repo, release) => {
  if (release === 'package') return package_version()
  if (release === 'latest') return await latest_release_tag_with_manifest(repo)
  return release
}

const not_found = 404
const server_error = 500
const retry_attempts = 5
const retry_base_ms = 2000
const ms_per_second = 1000

/**
 * A freshly published asset 404s until GitHub propagates it; a 5xx is the CDN
 * having a moment. Both are worth waiting on. Anything else is a real answer.
 * @param {number} status
 */
export const is_retryable_status = status =>
  status === not_found || status >= server_error

/** @param {number} ms */
const sleep = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })

/**
 * `ship` publishes the release and verifies it in the same breath, so retry
 * whole passes rather than each spelling: the bare tag legitimately never
 * resolves when `release:gh` tagged `v<version>`, and per-candidate backoff
 * would burn the whole budget waiting on it.
 * @param {{ repo: string, release: string }} opts
 * @param {{ fetch_impl?: typeof fetch, sleep_impl?: sleep, attempts?: number }} [injected]
 */
export const load_github_manifest = async (
  { repo, release },
  { fetch_impl = fetch, sleep_impl = sleep, attempts = retry_attempts } = {}
) => {
  const tag = await resolve_release_tag(repo, release)
  const candidates = release === 'latest' ? [tag] : release_tag_candidates(tag)
  const tried = candidates.map(candidate =>
    github_download_url(repo, candidate)
  )

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let propagating = false

    for (const candidate of candidates) {
      const url = github_download_url(repo, candidate)
      // eslint-disable-next-line no-await-in-loop -- sequential fallbacks
      const response = await fetch_impl(url, {
        cache: 'no-store',
        redirect: 'follow',
        headers: { Accept: 'application/octet-stream' }
      })
      if (!response.ok) {
        if (is_retryable_status(response.status)) propagating = true
        continue
      }

      // eslint-disable-next-line no-await-in-loop -- sequential fallbacks
      const manifest = await response.json()
      return {
        manifest,
        source: `github:${repo}@${candidate}`
      }
    }

    if (!propagating || attempt === attempts) break

    const wait = retry_base_ms * 2 ** (attempt - 1)
    console.info(
      `Waiting ${wait / ms_per_second}s for ${manifest_asset} to publish...`
    )
    // eslint-disable-next-line no-await-in-loop -- sequential backoff
    await sleep_impl(wait)
  }

  throw new Error(
    `Could not download ${manifest_asset} for release ${tag} from ${repo}. Tried:\n` +
      `${tried.map(u => `  ${u}`).join('\n')}\n` +
      `Operators: attach the deployed dist manifesto with:\n` +
      `  gh release upload ${tag} "${frontend_out(manifest_asset)}"\n` +
      `Or: npm run release:gh`
  )
}

export const load_manifest = async ({
  base_url,
  manifest_path,
  release,
  from_site,
  repo
}) => {
  if (manifest_path) {
    const raw = fs.readFileSync(manifest_path, 'utf8')
    return {
      manifest: JSON.parse(raw),
      source: `file:${manifest_path}`
    }
  }

  if (release) return load_github_manifest({ repo, release })

  const url = `${base_url}/build-manifest.json`
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Could not load manifesto from ${url}`)
  return {
    manifest: await response.json(),
    source: `site:${url}`
  }
}

/** @param {string} base_url @param {string} file_path @param {string} expected */
export const verify_file = async (base_url, file_path, expected) => {
  const url = `${base_url}${file_path}`
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok)
    return { file_path, ok: false, message: `HTTP ${response.status}` }

  const actual = sha256_bytes(await response.arrayBuffer())
  if (actual === expected) return { file_path, ok: true }

  return {
    file_path,
    ok: false,
    message: `expected ${expected}\n  actual   ${actual}`
  }
}

const SETTLE_STEP_MS = 15_000

/**
 * Check every item, then re-check only the failures every 15 seconds until
 * they pass or `settle` seconds run out. A deploy can lag its check.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => Promise<{ ok: boolean }>} check
 * @param {number} settle seconds
 * @param {(ms: number) => Promise<void>} [wait]
 */
export const settled = async (items, check, settle, wait = sleep) => {
  const results = new Map()
  let pending = items
  const until = Date.now() + settle * ms_per_second
  for (;;) {
    const round = await Promise.all(pending.map(check))
    round.forEach((result, i) => results.set(pending[i], result))
    pending = pending.filter((_, i) => !round[i].ok)
    if (!pending.length || Date.now() >= until) break
    console.info(`Settling:  ${pending.length} not yet live; again in 15s`)
    await wait(SETTLE_STEP_MS)
  }
  return items.map(item => results.get(item))
}

/** sync, proxy, and gate: each running stamp against this checkout's staged one. */
export const verify_services = async ({
  services = SERVICES,
  settle,
  environment = 'production'
}) => {
  const { environment_settings } =
    await import('#root/src/settings/environments.js')
  const { execFileSync } = await import('node:child_process')
  const { stamp_of } = await import('#root/lib/release.js')
  const urls = environment_settings(environment).services
  const root = path.resolve(path.dirname(script_path), '..')
  const out = out_path('verify-services')
  const want = Object.fromEntries(
    services.map(service => {
      const stage = execFileSync(
        'bash',
        [
          path.join(root, 'server/scripts/stage-service.sh'),
          service,
          out,
          // stage as each deploy.sh does: only the gate bakes in its environment
          ...(STAGED_WITH_ENVIRONMENT.includes(service) ? [environment] : [])
        ],
        { encoding: 'utf8' }
      ).trim()
      return [service, stamp_of(stage)]
    })
  )
  fs.rmSync(out, { recursive: true, force: true })
  const check = async service => {
    const expected = want[service]
    try {
      const response = await fetch(`${urls[`${service}_url`]}/v1/release`, {
        cache: 'no-store'
      })
      if (!response.ok)
        return { service, ok: false, message: `HTTP ${response.status}` }
      const got = await response.json()
      return {
        service,
        ok: got.version === expected.version && got.bundle === expected.bundle,
        message: `expected ${expected.version} ${expected.bundle}\n  actual   ${got.version} ${got.bundle}`
      }
    } catch (error) {
      return { service, ok: false, message: String(error?.message ?? error) }
    }
  }
  const results = await settled(services, check, settle)
  for (const result of results)
    if (result.ok)
      console.info(`PASS ${result.service} ${want[result.service].version}`)
    else console.error(`FAIL ${result.service} - ${result.message}`)
  const failed = results.filter(result => !result.ok).length
  console.info(`Services:  ${results.length - failed}/${results.length} match`)
  console.info(failed ? 'Result:    NOT LEGIT' : 'Result:    LEGIT')
  return failed ? 1 : 0
}

export const main = async (
  argv = process.argv.slice(2),
  { load = load_manifest, verify = verify_file } = {}
) => {
  const parsed = parse_args(argv)
  if (parsed.help) {
    console.info(help_text)
    return 0
  }
  const { base_url, manifest_path, release, from_site, repo, settle } = parsed
  if (parsed.services)
    return verify_services({ services: parsed.services, settle })
  const { manifest, source } = await load({
    base_url,
    manifest_path,
    release,
    from_site,
    repo
  })
  const skipped = Object.keys(manifest.files ?? {}).filter(is_release_junk)
  const entries = Object.entries(manifest.files ?? {})
    .filter(([file_path]) => !is_release_junk(file_path))
    .sort(([a], [b]) => a.localeCompare(b))

  if (!entries.length) {
    console.error('Manifesto has no files to verify')
    return 1
  }

  let trust = 'site manifesto only (not independent)'
  if (source.startsWith('github:')) trust = 'GitHub release (independent)'
  else if (source.startsWith('file:')) trust = 'local manifesto'

  console.info(`Instance:  ${base_url}`)
  console.info(`Version:   ${manifest.version ?? '(none)'}`)
  console.info(`Commit:    ${manifest.git_commit ?? '(none)'}`)
  if (manifest.bundle_sha256)
    console.info(`Bundle:    ${manifest.bundle_sha256}`)
  console.info(`Trust:     ${trust}`)
  console.info(`Source:    ${source}`)
  console.info(`Checking:  ${entries.length} files`)
  if (skipped.length)
    console.info(
      `Skipping:  ${skipped.length} junk path(s): ${skipped.join(', ')}`
    )

  const results = await settled(
    entries,
    ([file_path, expected]) => verify(base_url, file_path, expected),
    settle
  )

  let passed = 0
  let failed = 0

  for (const result of results)
    if (result.ok) passed++
    else {
      console.error(`FAIL ${result.file_path} - ${result.message}`)
      failed++
    }

  console.info(`Files:     ${passed}/${passed + failed} match`)
  if (failed > 0) {
    console.error('Result:    NOT LEGIT')
    return 1
  }

  console.info('Result:    LEGIT')
  return 0
}

await run_entry(import.meta.url, async () => process.exit(await main()))
