import { spawn } from 'node:child_process'
import { readFile as read_file } from 'node:fs/promises'
import { product_paths } from '#root/src/settings/layout.js'
import { environment_settings } from '#root/src/settings/environments.js'
import { frontend_out, out_path } from '#root/src/settings/output.js'

const { root, frontend: frontend_path } = product_paths()
const project = `${root}/`
const frontend = `${frontend_path}/`
const usage = 'usage: realness frontend build|deploy [--env development|production] [--dry-run]\nDeploy requires --env. Build defaults to development.\n'

const execute = (step) => new Promise((resolve, reject) => {
  const child = spawn(step.command, step.args, { cwd: step.cwd, stdio: 'inherit' })
  child.once('error', reject)
  child.once('exit', (code, signal) => {
    if (signal) reject(new Error(`${step.command} stopped by ${signal}`))
    else resolve(code)
  })
})

/** Desktop build and deploy share a pipeline; deploy targets never use Firebase's active project. */
export const run_frontend = async (args, { stdout = process.stdout, stderr = process.stderr, actor = false } = {}) => {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    stdout.write(usage)
    return 0
  }
  const action = args[0]
  let environment
  let dry_run = false
  for (let index = 1; index < args.length; index++) {
    const arg = args[index]
    if (arg === '--env' && !environment && ['development', 'production'].includes(args[index + 1])) environment = args[++index]
    else if (arg === '--dry-run' && !dry_run) dry_run = true
    else {
      stderr.write(usage)
      return 1
    }
  }
  if (actor || !['build', 'deploy'].includes(action) || (action === 'deploy' && !environment) || (environment && !['development', 'production'].includes(environment))) {
    stderr.write(actor ? 'Frontend build and deploy run on the desktop.\n' : usage)
    return 1
  }
  environment ??= 'development'
  const production = environment === 'production'
  const steps = []
  const npm = (name) => steps.push({ command: 'npm', args: ['run', name], cwd: project })
  const node = (file, args = []) => steps.push({ command: process.execPath, args: [file, ...args], cwd: frontend })
  const vp = (args) => steps.push({ command: 'npm', args: ['exec', '--', 'vp', ...args], cwd: frontend })

  if (action === 'deploy' && production) npm('build:workers')
  npm('build:icons')
  if (production) npm('build:wasm')
  node('scripts/generate-toc.js')
  const mode = production ? [] : ['--mode', 'development']
  vp(['build', ...mode])
  if (production) node('scripts/check-interaction-css.js')
  vp(['build', '-c', 'vite.prerender.config.js', ...mode])
  node('scripts/prerender.js')
  node('scripts/build-manifest.js')

  if (action === 'deploy') {
    const { version } = JSON.parse(await read_file(`${project}package.json`, 'utf8'))
    const target = environment_settings(environment).project
    node('scripts/build-hosting-config.js')
    steps.push({ command: 'npm', args: ['exec', '--', 'firebase', 'deploy', '--only', production ? 'hosting:app,storage' : 'hosting', '--project', target, '-m', version, '--config', out_path('frontend', 'firebase.json')], cwd: frontend })
    if (production) node('scripts/verify-deploy.js', ['--manifest', frontend_out('build-manifest.json'), '--url', environment_settings(environment).public_url])
  }
  if (dry_run) {
    stdout.write(JSON.stringify({ action, environment, steps }, null, 2) + '\n')
    return 0
  }
  for (const step of steps) {
    const code = await execute(step)
    if (code !== 0) return code
  }
  return 0
}
