import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { is_release_junk } from './release-junk.js'

const default_repo = 'realness-online/web'
const default_url = 'https://realness.online'
const manifest_asset = 'build-manifest.json'
const script_path = fileURLToPath(import.meta.url)

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
  --help              Show this help

Operators: after deploy, attach the same dist manifesto to the release:
  npm run release:gh
`

const parse_args = () => {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.info(help_text)
    process.exit(0)
  }

  let base_url = default_url
  let manifest_path = null
  let release = null
  let from_site = false
  let repo = default_repo

  for (let i = 0; i < args.length; i++)
    if (args[i] === '--url' && args[i + 1]) base_url = args[++i]
    else if (args[i] === '--manifest' && args[i + 1]) manifest_path = args[++i]
    else if (args[i] === '--repo' && args[i + 1]) repo = args[++i]
    else if (args[i] === '--from-site') from_site = true
    else if (args[i] === '--release') {
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        release = args[++i]
        continue
      }
      release = 'package'
    }

  // Default root of trust: newest GitHub release that ships a manifesto.
  if (!manifest_path && !release && !from_site) release = 'latest'

  return {
    base_url: base_url.replace(/\/$/, ''),
    manifest_path,
    release,
    from_site,
    repo
  }
}

/** @param {ArrayBuffer | Buffer | string} bytes */
const sha256_bytes = bytes =>
  `sha256:${createHash('sha256').update(Buffer.from(bytes)).digest('hex')}`

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
      `Or: gh release upload <tag> dist/build-manifest.json`
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

const load_github_manifest = async ({ repo, release }) => {
  const tag = await resolve_release_tag(repo, release)
  const candidates = release === 'latest' ? [tag] : release_tag_candidates(tag)
  const tried = []

  // Try tag spellings in order; stop on the first manifest that downloads.
  for (const candidate of candidates) {
    const url = github_download_url(repo, candidate)
    tried.push(url)
    // eslint-disable-next-line no-await-in-loop -- sequential fallbacks
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      headers: { Accept: 'application/octet-stream' }
    })
    if (!response.ok) continue

    // eslint-disable-next-line no-await-in-loop -- sequential fallbacks
    const manifest = await response.json()
    return {
      manifest,
      source: `github:${repo}@${candidate}`
    }
  }

  throw new Error(
    `Could not download ${manifest_asset} for release ${tag} from ${repo}. Tried:\n` +
      `${tried.map(u => `  ${u}`).join('\n')}\n` +
      `Operators: attach the deployed dist manifesto with:\n` +
      `  gh release upload ${tag} dist/build-manifest.json\n` +
      `Or: npm run release:gh`
  )
}

const load_manifest = async ({
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
const verify_file = async (base_url, file_path, expected) => {
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

export const main = async () => {
  const { base_url, manifest_path, release, from_site, repo } = parse_args()
  const { manifest, source } = await load_manifest({
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
    process.exit(1)
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

  const results = await Promise.all(
    entries.map(([file_path, expected]) =>
      verify_file(base_url, file_path, expected)
    )
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
    process.exit(1)
  }

  console.info('Result:    LEGIT')
  process.exit(0)
}

const is_main =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(script_path)

if (is_main)
  try {
    await main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
