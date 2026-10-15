import { cp, mkdir } from 'node:fs/promises'
import { existsSync as exists_sync } from 'node:fs'
import { createRequire as create_require } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL as path_to_file_url } from 'node:url'
import { project_root as project } from '#root/src/settings/layout.js'

/**
 * Export a portable starter; actors already carry the generated examples.
 * @param {string[]} args
 * @param {object} [options]
 * @param {boolean} [options.actor]
 * @param {string} [options.root]
 * @param {NodeJS.WriteStream & { fd: 1 }} [options.stdout]
 */
export const run_example = async (
  [kind, destination_arg],
  { actor = false, root, stdout = process.stdout } = {}
) => {
  if (!['static', 'app'].includes(kind) || !destination_arg)
    throw new Error('usage: realness example static|app <destination>')
  const destination = resolve(destination_arg)
  if (exists_sync(destination))
    throw new Error(`destination exists: ${destination}`)
  if (!actor && kind === 'static') {
    const entry = create_require(join(project, 'package.json')).resolve(
      'brayness/publish/view'
    )
    const { export_static } = await import(path_to_file_url(entry).href)
    await export_static(destination)
  } else {
    const source = actor
      ? join(root ?? process.env.BRAYNESS_ROOT ?? '/brayness', 'examples', kind)
      : join(project, 'tools/examples', kind)
    await mkdir(dirname(destination), { recursive: true })
    await cp(source, destination, {
      recursive: true,
      force: false,
      errorOnExist: true
    })
  }
  stdout.write(`${destination}\n`)
  return 0
}
