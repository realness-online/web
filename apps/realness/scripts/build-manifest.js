import { createHash as create_hash } from 'node:crypto'
import { execSync as exec_sync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { is_release_junk } from './release-junk.js'
import { frontend_out } from '#root/src/settings/output.js'
import { run_entry } from './lib/entry.js'

const __dirname = path.dirname(file_url_to_path(import.meta.url))
const project_root = path.join(__dirname, '..')
const manifest_name = 'build-manifest.json'

/** @param {string} file_path */
const sha256_file = file_path => {
  const bytes = fs.readFileSync(file_path)
  return `sha256:${create_hash('sha256').update(bytes).digest('hex')}`
}

const git_commit = () => {
  try {
    return exec_sync('git rev-parse HEAD', {
      cwd: project_root,
      encoding: 'utf8'
    }).trim()
  } catch {
    return null
  }
}

/**
 * Walk dist/, remove OS junk so the tree matches what Hosting will upload,
 * and hash the remaining files.
 * @param {string} dir
 * @param {string} base_dir
 * @returns {Record<string, string>}
 */
const hash_dist_files = (dir, base_dir) => {
  /** @type {Record<string, string>} */
  const files = {}
  for (const name of fs.readdirSync(dir)) {
    const full_path = path.join(dir, name)
    const relative = path
      .relative(base_dir, full_path)
      .split(path.sep)
      .join('/')
    if (is_release_junk(relative)) {
      fs.rmSync(full_path, { recursive: true, force: true })
      continue
    }
    const stat = fs.statSync(full_path)
    if (stat.isDirectory())
      Object.assign(files, hash_dist_files(full_path, base_dir))
    else {
      const url_path = `/${relative}`
      if (url_path === `/${manifest_name}`) continue
      files[url_path] = sha256_file(full_path)
    }
  }
  return files
}

/**
 * Workbox writes its worker into a temp folder whose name changes every build,
 * so the source map named a different path each time and no two builds matched.
 * Name the folder once, before hashing.
 */
export const stable_worker_map = dist_dir => {
  const map_path = path.join(dist_dir, 'service.worker.js.map')
  if (!fs.existsSync(map_path)) return
  const map = JSON.parse(fs.readFileSync(map_path, 'utf8'))
  map.sources = map.sources.map(source =>
    source.replace(/^.*\/artifacts\/pi\/[0-9a-f]+\//, 'workbox/')
  )
  fs.writeFileSync(map_path, JSON.stringify(map))
}

/** Hash the built site into dist/build-manifest.json. */
export const main = () => {
  const dist_dir = frontend_out()
  const manifest_path = path.join(dist_dir, manifest_name)
  if (!fs.existsSync(dist_dir))
    throw new Error(`dist/ not found - run npm run build first`)

  const package_json = JSON.parse(
    fs.readFileSync(path.join(project_root, 'package.json'), 'utf8')
  )

  stable_worker_map(dist_dir)
  const files = hash_dist_files(dist_dir, dist_dir)
  const paths = Object.keys(files).sort()
  const bundle_digest = create_hash('sha256')
  for (const url_path of paths)
    bundle_digest.update(`${url_path}\n${files[url_path]}\n`)

  const manifest = {
    version: package_json.version,
    git_commit: git_commit(),
    built_at: new Date().toISOString(),
    origin: 'https://realness.online',
    bundle_sha256: `sha256:${bundle_digest.digest('hex')}`,
    files
  }

  fs.writeFileSync(manifest_path, `${JSON.stringify(manifest, null, 2)}\n`)
  console.info(
    `Wrote ${manifest_path} (${paths.length} files, v${manifest.version})`
  )
  return manifest
}

await run_entry(import.meta.url, main)
