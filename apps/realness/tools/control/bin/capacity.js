import { readFile as read_file, open } from 'node:fs/promises'
import { execFile as exec_file } from 'node:child_process'
import { promisify } from 'node:util'
import { parseArgs as parse_args } from 'node:util'
import { run_capacity, validate_capacity } from '#root/src/control/capacity.js'
import { prepare_workloads } from '#root/src/control/capacity-workloads.js'
import {
  prepare_bundle,
  verify_bundle
} from '#root/src/control/capacity-bundle.js'

const private_file_mode = 0o600

const { values } = parse_args({
  options: {
    config: { type: 'string' },
    run: { type: 'boolean', default: false },
    'secret-file': { type: 'string' },
    journal: { type: 'string' },
    prepare: { type: 'string' },
    manifest: { type: 'string' }
  }
})
if (!values.config)
  throw new Error('--config required; omit --run for offline validation')
const config = validate_capacity(
  JSON.parse(await read_file(values.config, 'utf8'))
)
if (
  !Array.isArray(config.sample_argv) ||
  !config.sample_argv.length ||
  config.sample_argv.some(arg => typeof arg !== 'string')
)
  throw new Error('sample_argv must name a halo resource sampler')
if (values.prepare && (values.run || values.manifest))
  throw new Error('--prepare cannot run or verify workloads')
if (values.manifest)
  config.build_id = await verify_bundle(values.manifest, values.config)
if (values.prepare) {
  const manifest = await prepare_bundle({
    config,
    config_file: values.config,
    output: values.prepare
  })
  process.stdout.write(
    `${JSON.stringify({ prepared: true, ...manifest }, null, 2)}\n`
  )
} else if (!values.run)
  process.stdout.write(
    `${JSON.stringify({ validated: true, execution: false, config }, null, 2)}\n`
  )
else {
  if (!values['secret-file'] || !values.journal)
    throw new Error('--secret-file and new --journal required')
  if (config.min_guest_overlap && !values.manifest)
    throw new Error('guest-evidenced runs require a prepared --manifest')
  config.workloads = await prepare_workloads(config.workloads, values.config)

  const secret = await read_file(values['secret-file'], 'utf8')
  const file = await open(values.journal, 'wx', private_file_mode)
  const controller = new AbortController()
  const interrupt = () => controller.abort(new Error('interrupted'))
  process.once('SIGINT', interrupt)
  process.once('SIGTERM', interrupt)
  const execute = promisify(exec_file)
  let journal_tail = Promise.resolve()
  try {
    const report = await run_capacity(config, {
      secret,
      signal: controller.signal,
      async sample(signal) {
        const { stdout } = await execute(
          config.sample_argv[0],
          config.sample_argv.slice(1),
          {
            timeout: config.request_ms,
            signal,
            maxBuffer: 65536
          }
        )
        return JSON.parse(stdout)
      },
      journal(event) {
        journal_tail = journal_tail.then(async () => {
          await file.write(`${JSON.stringify(event)}\n`)
          await file.sync()
        })
        return journal_tail
      }
    })
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    if (!report.complete) process.exitCode = 1
  } finally {
    process.removeListener('SIGINT', interrupt)
    process.removeListener('SIGTERM', interrupt)
    await file.close()
  }
}
