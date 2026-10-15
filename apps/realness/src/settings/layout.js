import { resolve, join } from 'node:path'

export const project_root = resolve(import.meta.dirname, '../..')

/** Source domains change here when their files move; entry and platform paths stay stable. */
export const source_folders = {
  can: 'src/can',
  files: 'src/files',
  harness: 'src/harness',
  sign_on: 'src/sign-on',
  command: 'src/command',
  control: 'src/control',
  publish: 'src/publish',
  host: 'src/host',
  sync: 'src/sync',
  proxy: 'src/proxy',
  gate: 'src/gate',
  app: 'src/app'
}

/** Absolute paths for checkout tools; runtime modules never need a harness root. */
/**
 * Every source folder under `root`, by the name used in `source_folders`.
 * @param {string} [root]
 * @returns {{ root: string, frontend: string, themes: string, renderer: string, static_preset: string } & { [folder: string]: string }}
 */
export const product_paths = (root = project_root) => {
  /** @type {Record<string, string>} */
  const folders = {}
  for (const [name, folder] of Object.entries(source_folders))
    folders[name] = join(root, folder)
  return {
    root,
    frontend: join(root, 'frontend'),
    themes: join(root, 'themes'),
    renderer: join(root, 'tools/publish/renderer'),
    static_preset: join(root, 'tools/examples/static'),
    ...folders
  }
}

const shared_folders = () => [
  'lib',
  'src/settings',
  source_folders.can,
  source_folders.files,
  source_folders.harness,
  `${source_folders.sign_on}/node`
]

export const actor_folders = () => [
  ...shared_folders(),
  source_folders.command,
  source_folders.sync,
  'tools/cli/bin',
  source_folders.control,
  'tools/control'
]

export const host_files = [
  'package.json',
  'lib/http.js',
  'lib/path-parts.js',
  'lib/units.js',
  'lib/lines.js',
  'lib/output.js',
  'lib/output.sh',
  'lib/websocket.js',
  'tools/control/webspace.config.js'
]

/** A pushed host carries the same actor dependencies as a locally built template. */
export const host_folders = () => {
  const folders = [
    ...actor_folders().filter(
      folder => !['lib', 'tools/control'].includes(folder)
    ),
    source_folders.host,
    source_folders.sync,
    source_folders.proxy,
    'server/host',
    'server/sync',
    'server/proxy',
    'server/scripts',
    'tools/control/scripts',
    'tools/control/escape-probe'
  ]
  return folders.filter(
    folder =>
      !folders.some(
        parent => parent !== folder && folder.startsWith(`${parent}/`)
      )
  )
}

/** Standard-library services include only their dependency domains and stable entry points. */
export const service_folders = service => {
  if (!['sync', 'proxy', 'gate'].includes(service))
    throw Error(`unknown service: ${service}`)
  return [
    ...shared_folders(),
    source_folders.sync,
    `server/${service}/bin`,
    ...(service === 'sync' ? [] : [source_folders.proxy]),
    ...(service === 'gate' ? [source_folders.gate] : [])
  ]
}
