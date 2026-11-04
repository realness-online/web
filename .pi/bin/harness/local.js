#!/usr/bin/env node
import { spawnSync as spawn_sync } from 'node:child_process'
import { product_import } from '../lib/product.js'

const { local_plan, start_local, refresh_host_name } = await product_import('local/stack')
const { monitor_local } = await product_import('local/monitor')

/** Stop the halo and its Lima VM. */
const halo_down = halo => {
  const result = spawn_sync('npm', ['run', '--silent', 'realness', '--', 'local', 'halo', 'down', '--vm'], {
    cwd: halo.cwd,
    stdio: 'inherit'
  })
  if (result.status !== 0) process.stderr.write('local halo did not stop cleanly; check it by hand\n')
}

/** Stop the halo only when this run started it. */
const stop_started_halo = services => {
  const halo = services.find(service => service.name === 'halo')
  if (halo?.pid && !halo.reused) halo_down(halo)
}

/** @param {string[]} command */
const pids_of = command =>
  spawn_sync(command[0], command.slice(1), { encoding: 'utf8' })
    .stdout.split('\n')
    .map(Number)
    .filter(pid => pid && pid !== process.pid)

/** @param {string} url */
const listeners = url => pids_of(['lsof', '-nP', `-iTCP:${new URL(url).port || 443}`, '-sTCP:LISTEN', '-t'])

/** @param {number[]} pids @param {NodeJS.Signals} signal */
const signal_all = (pids, signal) => {
  for (const pid of pids) {
    process.kill(pid, signal)
    process.stdout.write(`${signal} ${pid}\n`)
  }
}

/** @param {number[]} pids */
const wait_gone = async pids => {
  for (let tries = 0; tries < 50 && pids.some(pid => spawn_sync('kill', ['-0', String(pid)]).status === 0); tries++)
    await new Promise(resolve => setTimeout(resolve, 200))
}

/** Stop every local stack service, whichever run started it. */
const stop_all = async services => {
  const runs = pids_of(['pgrep', '-f', 'harness/local.js'])
  signal_all(runs, 'SIGINT')
  await wait_gone(runs)
  const halo = services.find(service => service.name === 'halo')
  if (listeners(halo.url).length) halo_down(halo)
  const rest = [
    ...services.filter(service => service.url && service !== halo).flatMap(service => listeners(service.url)),
    ...pids_of(['pgrep', '-f', 'watch-workers.js'])
  ]
  signal_all(rest, 'SIGTERM')
  await wait_gone(rest)
}

const args = process.argv.slice(2)
if (args.length > 1 || (args.length && !['--dry-run', '--help', '--stop'].includes(args[0])))
  throw new Error('usage: npm run local -- [--dry-run|--help|--stop]')
if (args[0] === '--help') {
  process.stdout.write(
    'npm run local starts the local sync, halo, worker watchers, gate, and frontend.\nCtrl-C stops its local child processes and, when it started it, the halo and the Lima VM.\nA halo it reused stays up.\nnpm run local -- --stop stops every local service and the halo, whichever run started them.\nnpm start still starts Pi; npm start -- --local starts both and stops the stack when Pi exits.\n'
  )
} else if (args[0] === '--stop') {
  await stop_all(local_plan().services)
} else {
  await refresh_host_name()
  const plan = local_plan()
  if (args[0] === '--dry-run') process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)
  else {
    const controller = new AbortController()
    const abort = () => controller.abort()
    process.on('SIGINT', abort)
    process.on('SIGTERM', abort)
    let cleanup
    try {
      cleanup = await start_local(plan.services, {
        signal: controller.signal,
        changed: service =>
          process.stdout.write(`${service.name}: ${service.state}${service.reused ? ' (already running)' : ''}\n`)
      })
      await monitor_local(plan.services, { url: plan.url, signal: controller.signal })
    } catch (error) {
      if (error.name !== 'AbortError') {
        process.stderr.write(`${error.message}\n`)
        process.exitCode = 1
      }
    } finally {
      stop_started_halo(plan.services)
      await cleanup?.()
      process.off('SIGINT', abort)
      process.off('SIGTERM', abort)
    }
  }
}
