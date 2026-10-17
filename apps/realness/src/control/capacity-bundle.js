import {
  readFile as read_file,
  writeFile as write_file,
  mkdir
} from 'node:fs/promises'
import { dirname, resolve, join, relative, sep } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { createHash as create_hash } from 'node:crypto'

const source_root = file_url_to_path(new URL('../../', import.meta.url))
const sources = [
  'src/control/capacity.js',
  'src/control/capacity-level.js',
  'src/control/capacity-result.js',
  'src/control/capacity-evidence.js',
  'src/control/capacity-workloads.js',
  'src/control/capacity-bundle.js',
  'tools/control/bin/capacity.js',
  'tools/control/bin/capacity-sample.js',
  'tools/control/bin/capacity-workload.js'
]
const hash = bytes => create_hash('sha256').update(bytes).digest('hex')

export const verify_bundle = async (manifest_file, config_file) => {
  const root = dirname(resolve(manifest_file))
  const manifest = JSON.parse(await read_file(manifest_file, 'utf8'))
  if (
    !manifest.files ||
    manifest.build_id !== hash(JSON.stringify(manifest.files))
  )
    throw new Error('invalid capacity build manifest')
  const config_path = relative(root, resolve(config_file)).split(sep).join('/')
  if (!manifest.files[config_path])
    throw new Error('configuration is outside the capacity manifest')
  await Promise.all(
    Object.entries(manifest.files).map(async ([path, expected]) => {
      const file = resolve(root, path)
      if (
        !file.startsWith(`${root}${sep}`) ||
        hash(await read_file(file)) !== expected
      )
        throw new Error(`capacity build mismatch: ${path}`)
    })
  )
  return manifest.build_id
}

export const prepare_bundle = async ({ config, config_file, output }) => {
  const reads = new Map()
  const read = path => {
    if (!reads.has(path)) reads.set(path, read_file(path))
    return reads.get(path)
  }
  /** @type {Map<string, Buffer>} */
  const files = new Map()
  await Promise.all(
    sources.map(async path => {
      files.set(path, await read(join(source_root, path)))
    })
  )
  const workloads = await Promise.all(
    config.workloads.map(async workload => {
      if (workload.stdin_b64)
        throw new Error(
          'capacity bundles require source files, not embedded stdin'
        )
      if (!workload.stdin_file) return workload
      const bytes = await read(
        resolve(dirname(resolve(config_file)), workload.stdin_file)
      )
      const path = `workloads/${hash(bytes)}.js`
      files.set(path, bytes)
      return { ...workload, stdin_file: path }
    })
  )
  files.set(
    'capacity.json',
    Buffer.from(`${JSON.stringify({ ...config, workloads }, null, 2)}\n`)
  )
  files.set(
    'package.json',
    Buffer.from(
      `${JSON.stringify({ private: true, type: 'module', imports: { '#root/*': './*' }, scripts: { 'check:capacity': 'node tools/control/bin/capacity.js' } }, null, 2)}\n`
    )
  )
  const entries = Object.fromEntries(
    [...files]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, bytes]) => [path, hash(bytes)])
  )
  const manifest = { build_id: hash(JSON.stringify(entries)), files: entries }
  await mkdir(output)
  await Promise.all(
    [...files].map(async ([path, bytes]) => {
      const destination = join(output, path)
      await mkdir(dirname(destination), { recursive: true })
      await write_file(destination, bytes, { flag: 'wx' })
    })
  )
  await write_file(
    join(output, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: 'wx' }
  )
  return manifest
}
