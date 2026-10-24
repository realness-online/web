import { spawn } from 'node:child_process'
import { run_entry } from './lib/entry.js'

export const worker_names = ['vector', 'compressor', 'tracer']

/**
 * Watch-build every worker; stop them all when one fails or on a signal.
 * @param {object} [options]
 * @param {typeof spawn} [options.start]
 * @param {(code: number) => void} [options.exit]
 * @param {NodeJS.Process} [options.host]
 */
export const main = ({
  start = spawn,
  exit = code => process.exit(code),
  host = process
} = {}) => {
  const children = []
  const stop_all = () => {
    for (const child of children) child.kill('SIGTERM')
  }
  for (const worker_name of worker_names) {
    const child = start('vp', ['build', '-c', 'workers.config.js', '--watch'], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, WORKER_NAME: worker_name }
    })
    child.on('exit', exit_code => {
      if (exit_code === 0) return
      stop_all()
      exit(exit_code ?? 1)
    })
    children.push(child)
  }
  for (const signal of ['SIGINT', 'SIGTERM'])
    host.on(signal, () => {
      stop_all()
      exit(0)
    })
  return children
}

await run_entry(import.meta.url, main)
