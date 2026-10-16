import { cp, mkdir } from 'node:fs/promises'
import { existsSync as exists_sync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { project_root as project } from '#root/src/settings/layout.js'

/**
 * Export a portable starter; actors already carry the generated examples.
 * @param {string[]} args
 * @param {object} [options]
 * @param {boolean} [options.actor]
 * @param {string} [options.root]
 * @param {(destination: string) => Promise<unknown>} [options.export_static]
 * @param {NodeJS.WriteStream & { fd: 1 }} [options.stdout]
 */
export const run_example = async (
  [kind, destination_arg],
  { actor = false, root, export_static, stdout = process.stdout } = {}
) => {
  if (!['static', 'app'].includes(kind) || !destination_arg)
    throw new Error('usage: realness example static|app <destination>')
  const destination = resolve(destination_arg)
  if (exists_sync(destination))
    throw new Error(`destination exists: ${destination}`)
  if (!actor && kind === 'static') {
    if (!export_static)
      throw new Error('static export requires the desktop command')
    await export_static(destination)
  } else {
    const harness = actor ? (root ?? '/realness') : resolve(project, '../..')
    const source = join(harness, '.pi/examples', kind)
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
