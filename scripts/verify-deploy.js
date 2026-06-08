import { createHash } from 'node:crypto'
import fs from 'node:fs'

const parse_args = () => {
  const args = process.argv.slice(2)
  let base_url = 'https://realness.online'
  let manifest_path = null
  for (let i = 0; i < args.length; i++)
    if (args[i] === '--url' && args[i + 1]) base_url = args[++i]
    else if (args[i] === '--manifest' && args[i + 1]) manifest_path = args[++i]

  return { base_url: base_url.replace(/\/$/, ''), manifest_path }
}

/** @param {ArrayBuffer} bytes */
const sha256_bytes = bytes =>
  `sha256:${createHash('sha256').update(Buffer.from(bytes)).digest('hex')}`

const load_manifest = async ({ base_url, manifest_path }) => {
  if (manifest_path) {
    const raw = fs.readFileSync(manifest_path, 'utf8')
    return JSON.parse(raw)
  }
  const url = `${base_url}/build-manifest.json`
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Could not load manifest from ${url}`)
  return response.json()
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

const { base_url, manifest_path } = parse_args()
const manifest = await load_manifest({ base_url, manifest_path })
const entries = Object.entries(manifest.files ?? {}).sort(([a], [b]) =>
  a.localeCompare(b)
)

if (!entries.length) {
  console.error('Manifest has no files to verify')
  process.exit(1)
}

console.info(
  `Verifying ${entries.length} files against ${base_url} (v${manifest.version}, ${manifest.git_commit ?? 'no git_commit'})`
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

console.info(`Done: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
