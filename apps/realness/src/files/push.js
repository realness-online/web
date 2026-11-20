import { spawn } from 'node:child_process'
import { person_settings } from '#root/src/settings/environments.js'

/**
 * The Mac's own lane in production storage. Only this machine writes here,
 * with its own Google account, so no sync pass is needed.
 * @param {{ phone: string, bucket?: string }} options
 */
export const push_destination = ({
  phone,
  bucket = person_settings.services.bucket
}) => `gs://${bucket}/people/${phone}/harness/`

/**
 * The argv that copies the Mac's files up. It carries no delete flag, because
 * the Mac must never erase what an actor wrote.
 * @param {{ source: string, destination: string, dry_run?: boolean }} options
 */
export const push_args = ({ source, destination, dry_run = false }) => [
  'rsync',
  '-r',
  ...(dry_run ? ['-n'] : []),
  source,
  destination
]

/**
 * Run gsutil with `args`, reporting its output line by line.
 * @param {{ args: string[], on_line?: (line: string) => void, run?: typeof spawn }} options
 */
export const push = ({ args, on_line = () => {}, run = spawn }) =>
  new Promise((resolve, reject) => {
    const child = run('gsutil', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const read = buffer => {
      for (const line of buffer.toString().split('\n'))
        if (line.trim()) on_line(line)
    }
    child.stdout?.on('data', read)
    child.stderr?.on('data', read)
    child.on('error', reject)
    child.on('close', code =>
      code === 0
        ? resolve(undefined)
        : reject(new Error(`gsutil failed: ${code}`))
    )
  })
