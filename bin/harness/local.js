#!/usr/bin/env node
import { spawnSync as spawn_sync } from 'node:child_process'
import { product_import } from '../lib/product.js'

const { local_plan, start_local } = await product_import('local/stack')
const { monitor_local } = await product_import('local/monitor')

/** Stop the halo and its Lima VM only when this run started them. */
const stop_started_halo = services => {
  const halo = services.find(service => service.name === 'halo')
  if (!halo?.pid || halo.reused) return
  const result = spawn_sync(
    'npm',
    ['run', '--silent', 'realness', '--', 'local', 'halo', 'down', '--vm'],
    { cwd: halo.cwd, stdio: 'inherit' }
  )
  if (result.status !== 0)
    process.stderr.write('local halo did not stop cleanly; check it by hand\n')
}

const args = process.argv.slice(2)
if (args.length > 1 || (args.length && !['--dry-run', '--help'].includes(args[0]))) throw new Error('usage: npm run local -- [--dry-run|--help]')
if (args[0] === '--help') {
  process.stdout.write('npm run local starts the local sync, halo, worker watchers, gate, and frontend.\nCtrl-C stops its local child processes and, when it started it, the halo and the Lima VM.\nA halo it reused stays up.\nnpm start still starts Pi; npm start -- --local starts both and stops the stack when Pi exits.\n')
} else {
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
        changed: service => process.stdout.write(`${service.name}: ${service.state}${service.reused ? ' (already running)' : ''}\n`)
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
