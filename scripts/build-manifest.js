import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const project_root = path.join(__dirname, '..')
const dist_dir = path.join(project_root, 'dist')
const manifest_name = 'build-manifest.json'
const manifest_path = path.join(dist_dir, manifest_name)

/** @param {string} file_path */
const sha256_file = file_path => {
  const bytes = fs.readFileSync(file_path)
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`
}

const git_commit = () => {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: project_root,
      encoding: 'utf8'
    }).trim()
  } catch {
    return null
  }
}

/**
 * @param {string} dir
 * @param {string} base_dir
 * @returns {Record<string, string>}
 */
const hash_dist_files = (dir, base_dir = dist_dir) => {
  /** @type {Record<string, string>} */
  const files = {}
  for (const name of fs.readdirSync(dir)) {
    const full_path = path.join(dir, name)
    const stat = fs.statSync(full_path)
    if (stat.isDirectory())
      Object.assign(files, hash_dist_files(full_path, base_dir))
    else {
      const url_path = `/${path.relative(base_dir, full_path).split(path.sep).join('/')}`
      if (url_path === `/${manifest_name}`) continue
      files[url_path] = sha256_file(full_path)
    }
  }
  return files
}

if (!fs.existsSync(dist_dir))
  throw new Error(`dist/ not found - run npm run build first`)

const package_json = JSON.parse(
  fs.readFileSync(path.join(project_root, 'package.json'), 'utf8')
)

const files = hash_dist_files(dist_dir)
const paths = Object.keys(files).sort()
const bundle_digest = createHash('sha256')
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
