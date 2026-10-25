/**
 * Lima, as an object with the methods a local halo needs.
 *
 * Every guest call passes --workdir: `limactl shell` mirrors the Mac's cwd into
 * the guest, so a deep path fails with `cd: No such file or directory` before
 * the command runs.
 */
import {
  mkdir,
  readFile as read_file,
  writeFile as write_file
} from 'node:fs/promises'
import { basename, join } from 'node:path'
import { run, attempt, stream } from './exec.js'
import { ROOT } from './paths.js'
import { out_root, sync_dir } from '#root/src/settings/output.js'

/**
 * The VM template names its halo folders as {{project}}, {{out}}, and
 * {{sync}} (where local sync keeps files), so no
 * checkout path is written into the repository. Each must be filled.
 */
export const render_vm_config = (
  template,
  { project = ROOT, out = out_root(), sync = sync_dir() } = {}
) => {
  const values = { project, out, sync }
  for (const [name, value] of Object.entries(values))
    if (typeof value !== 'string' || !value.startsWith('/'))
      throw new Error(`lima: ${name} folder must be an absolute path: ${value}`)

  return template.replace(/["']?\{\{(\w+)\}\}["']?/g, (token, name) => {
    if (!Object.hasOwn(values, name))
      throw new Error(`lima: unknown placeholder ${token}`)
    return JSON.stringify(values[name])
  })
}

/**
 * Write the filled config beside the generated files; Lima reads it once, at
 * creation.
 * @param {string} template_path
 * @param {object} [options]
 * @param {string} [options.project] defaults to the checkout root
 * @param {string} [options.out]
 * @param {string} [options.sync] defaults to sync_dir()
 */
const write_vm_config = async (
  template_path,
  { project = ROOT, out = out_root(), sync = sync_dir() } = {}
) => {
  const filled = render_vm_config(await read_file(template_path, 'utf8'), {
    project,
    out,
    sync
  })
  const folder = join(out, 'lima')
  await mkdir(folder, { recursive: true })
  const path = join(folder, basename(template_path))
  await write_file(path, filled)
  return path
}

export const limaTarget = config => {
  const shellArgs = (command, { user = null } = {}) => {
    const args = ['shell', `--workdir=${config.workdir}`, config.vm]
    if (!command) return args
    if (user === 'root') args.push('--', 'sudo', 'sh', '-c', command)
    else args.push('--', 'bash', '-c', command)
    return args
  }

  return {
    config,

    /** Start the VM if it is not running. Idempotent. */
    async start(yamlPath) {
      const status = await attempt('limactl', [
        'list',
        '--format',
        '{{.Status}}',
        config.vm
      ])
      const state = status.out.trim()
      if (state === 'Running') return 'already running'
      if (!state) {
        await run('limactl', [
          'start',
          `--name=${config.vm}`,
          await write_vm_config(yamlPath)
        ])
        return 'created'
      }
      await run('limactl', ['start', config.vm])
      return 'started'
    },

    /** Stop the VM, keeping its disks. */
    stop() {
      return run('limactl', ['stop', config.vm])
    },

    /** Run a shell string in the guest and return its output. */
    run(command, options = {}) {
      return run(
        'limactl',
        shellArgs(command, options),
        options.timeout ? { timeout: options.timeout } : {}
      )
    },

    /** Run a shell string in the guest, output going to this terminal. */
    stream(command, options = {}) {
      return stream('limactl', shellArgs(command, options))
    },

    /**
     * Run a script in the guest, by its path under the project root. /mnt/fc is
     * this project as the guest sees it, so the guest runs exactly the file the
     * Mac just wrote.
     */
    streamScript(path, { user = null } = {}) {
      return stream(
        'limactl',
        shellArgs(`bash ${config.workdir}/${path}`, { user })
      )
    },

    /** A command's output, or "" if it failed. For checks. */
    async out(command, options = {}) {
      const result = await attempt('limactl', shellArgs(command, options))
      return result.ok ? result.out.trim() : ''
    }
  }
}
