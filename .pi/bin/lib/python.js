import { spawnSync as spawn_sync } from 'node:child_process'

const CANDIDATES = /** @type {string[]} */ (
  [process.env.PYTHON, 'python3.11', 'python3'].filter(Boolean)
)

/** The interpreter for repo Python work: `PYTHON`, then 3.11, then whatever `python3` is. */
export const python_command = () => {
  for (const command of CANDIDATES)
    if (spawn_sync(command, ['--version'], { stdio: 'ignore' }).status === 0)
      return command
  throw new Error(`no Python interpreter among: ${CANDIDATES.join(', ')}`)
}