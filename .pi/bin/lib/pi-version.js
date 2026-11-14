import { existsSync as exists_sync, readFileSync as read_file_sync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** The version a runtime release pin names. */
export const pinned_version = runtime => JSON.parse(read_file_sync(join(runtime, 'release.json'), 'utf8')).version

/** The install folder above a selected fork's command, found by its proof file. */
const install_root = binary => {
  let folder = dirname(binary)
  for (let depth = 0; depth < 6; depth += 1) {
    if (exists_sync(join(folder, 'verification.json'))) return folder
    folder = dirname(folder)
  }
  return null
}

/** The version a selected fork installs, or null when the checkout selects none. */
export const selected_version = root => {
  const marker = join(root, '.pi/agent/state/fork-path')
  if (!exists_sync(marker)) return null
  const binary = resolve(root, read_file_sync(marker, 'utf8').trim())
  const install = install_root(binary)
  if (!install) return null
  const manifest = join(install, 'consumer/node_modules/@earendil-works/pi-coding-agent/package.json')
  return JSON.parse(read_file_sync(manifest, 'utf8')).version
}

/** Every place that names a Pi version, and the version it names. */
export const version_places = (root, runtime = join(root, '.pi/runtime')) => {
  const places = [{ place: runtime, version: pinned_version(runtime) }]
  const selected = selected_version(root)
  if (selected) places.push({ place: '.pi/agent/state/fork-path', version: selected })
  return places
}

/** One line per place whose version differs from the checkout pin. */
export const version_drift = (root, runtime = join(root, '.pi/runtime')) => {
  const [pin, ...others] = version_places(root, runtime)
  return others
    .filter(place => place.version !== pin.version)
    .map(place => `${place.place} names ${place.version}, pin names ${pin.version}`)
}
