import { spawn } from 'node:child_process'
import { fileURLToPath as file_url_to_path } from 'node:url'

const entry = file_url_to_path(
  new URL('../../tools/control/bin/webspace.js', import.meta.url)
)

/** Run desktop operator commands in their own process. */
export const run_control = (args, { actor, stdin, stdout, stderr }) => {
  if (actor) throw new Error('realness operator commands run on the desktop')
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    stdin.pipe(child.stdin)
    child.stdout.pipe(stdout, { end: false })
    child.stderr.pipe(stderr, { end: false })
    child.once('error', reject)
    child.once('close', (code, signal) => {
      stdin.unpipe(child.stdin)
      if (signal) reject(new Error(`realness operator stopped by ${signal}`))
      else resolve(code ?? 1)
    })
  })
}
