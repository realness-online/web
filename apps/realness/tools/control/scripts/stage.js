#!/usr/bin/env node
import {
  copyFileSync as copy_file_sync,
  cpSync as cp_sync,
  mkdirSync as mkdir_sync,
  readdirSync as readdir_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { RELEASE_FILE, stamp_of } from '#root/lib/release.js'
import { out_root } from '#root/src/settings/output.js'
import {
  actor_folders,
  halo_files,
  halo_folders,
  project_root as root,
  service_folders
} from '#root/src/settings/layout.js'

const SERVICES = ['sync', 'proxy', 'gate']

/**
 * Copy folders from the project into `stage`, leaving out directories named
 * in `skip_dirs` and files named in `skip_files` at any depth.
 * @param {string} stage
 * @param {string[]} folders
 * @param {{ skip_dirs: string[], skip_files?: string[] }} options
 */
const copy_folders = (stage, folders, { skip_dirs, skip_files = [] }) => {
  for (const folder of folders)
    cp_sync(join(root, folder), join(stage, folder), {
      recursive: true,
      preserveTimestamps: true,
      filter: source => {
        const name = basename(source)
        return !skip_dirs.includes(name) && !skip_files.includes(name)
      }
    })
}

/**
 * A Cloud Run service, ready to build: code, Dockerfile, release stamp.
 * @param {string} service sync, proxy, or gate
 * @param {string} [output] parent folder; the output root by default
 * @param {string} [environment] passed to the service at start
 * @returns {string} the staged folder
 */
export const stage_service = (service, output = '', environment = '') => {
  if (!SERVICES.includes(service))
    throw new Error(`unknown service: ${service}`)
  const stage = join(output || out_root(), `${service}-deploy`)
  rm_sync(stage, { recursive: true, force: true })
  mkdir_sync(stage, { recursive: true })
  copy_file_sync(join(root, 'package.json'), join(stage, 'package.json'))
  copy_folders(stage, service_folders(service), {
    skip_dirs: ['test', 'browser'],
    skip_files: ['.DS_Store']
  })
  const args = environment ? `, "--environment", "${environment}"` : ''
  write_file_sync(
    join(stage, 'Dockerfile'),
    `FROM node:22-slim
WORKDIR /app
COPY . .
ENV NODE_ENV=production
CMD ["node", "server/${service}/bin/${service}-service.js"${args}]
`
  )
  write_file_sync(
    join(stage, RELEASE_FILE),
    `${JSON.stringify(stamp_of(stage))}\n`
  )
  return stage
}

/**
 * The code a halo host runs.
 * @param {string} stage
 */
export const stage_halo = stage => {
  for (const file of halo_files) {
    mkdir_sync(join(stage, dirname(file)), { recursive: true })
    copy_file_sync(join(root, file), join(stage, file))
  }
  copy_folders(stage, halo_folders(), {
    skip_dirs: [
      'test',
      'checks',
      'browser',
      'node_modules',
      'dist',
      '__pycache__'
    ]
  })
}

/**
 * The actor runtime: package.json and the top-level `.js` of each actor folder.
 * @param {string} stage
 */
export const stage_runtime = stage => {
  mkdir_sync(stage, { recursive: true })
  copy_file_sync(join(root, 'package.json'), join(stage, 'package.json'))
  for (const folder of actor_folders()) {
    mkdir_sync(join(stage, folder), { recursive: true })
    for (const entry of readdir_sync(join(root, folder), {
      withFileTypes: true
    }))
      if (entry.isFile() && entry.name.endsWith('.js'))
        copy_file_sync(
          join(root, folder, entry.name),
          join(stage, folder, entry.name)
        )
  }
}

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const [target, first, output, environment] = process.argv.slice(2)
  if (target === 'service')
    process.stdout.write(`${stage_service(first, output, environment)}\n`)
  else if (target === 'halo' && first) stage_halo(first)
  else if (target === 'runtime' && first) stage_runtime(first)
  else
    throw new Error(
      'usage: stage.js service sync|proxy|gate [output] [environment] | halo <destination> | runtime <destination>'
    )
}
