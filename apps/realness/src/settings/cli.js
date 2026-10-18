import {
  actor_folders,
  halo_files,
  halo_folders,
  project_root,
  service_folders
} from './layout.js'
import {
  deployment_settings,
  environment_settings,
  local_settings
} from './environments.js'
import { frontend_out, out_path, out_root } from './output.js'

/** Quote trusted settings for Bash without executing their values. */
const shell_values = values =>
  Object.entries(values)
    .map(([key, value]) => `${key}='${String(value).replaceAll("'", "'\\''")}'`)
    .join('\n')

const [command, target, ...args] = process.argv.slice(2)
if (
  command === 'output' &&
  (!target || (target === '--root' && args.length === 1))
)
  process.stdout.write(`${out_root({ root: args[0] || project_root })}\n`)
else if (command === 'output' && target === 'frontend' && !args.length)
  process.stdout.write(`${frontend_out()}\n`)
else if (command === 'output' && target === 'frontend-notes' && !args.length)
  process.stdout.write(`${out_path('frontend', 'release-notes.md')}\n`)
else if (command === 'folders' && target === 'actor' && !args.length)
  process.stdout.write(`${actor_folders().join('\n')}\n`)
else if (command === 'folders' && target === 'halo' && !args.length)
  process.stdout.write(`${halo_folders().join('\n')}\n`)
else if (command === 'files' && target === 'halo' && !args.length)
  process.stdout.write(`${halo_files.join('\n')}\n`)
else if (command === 'folders' && target === 'service' && args.length === 1)
  process.stdout.write(`${service_folders(args[0]).join('\n')}\n`)
else if (
  command === 'shell' &&
  target === 'deploy' &&
  args.length === 2 &&
  args[0] === '--env'
)
  process.stdout.write(
    `${shell_values(deployment_settings(args[1], process.env))}\n`
  )
else if (
  command === 'shell' &&
  target === 'halo' &&
  args.length === 2 &&
  args[0] === '--env'
) {
  const { services } = environment_settings(args[1])
  process.stdout.write(
    `${shell_values({
      sync_url_default: services.sync_url,
      sites_url_default: services.sites_url ?? ''
    })}\n`
  )
} else if (command === 'shell' && target === 'local' && !args.length)
  process.stdout.write(
    `${shell_values({
      dev_project: local_settings.cloud.project,
      sync_url_default: `http://127.0.0.1:${local_settings.sync_port}`,
      sites_url_default: local_settings.cloud.services.sites_url,
      api_port: local_settings.api_port,
      halo_port: local_settings.halo_port,
      terminal_port: local_settings.terminal_port,
      gate_port: local_settings.gate_port,
      site_port: local_settings.site_port
    })}\n`
  )
else
  throw Error(
    'usage: settings output [frontend|frontend-notes|--root path] | folders actor|halo | files halo | folders service sync|proxy|gate | shell deploy|halo --env development|production | shell local'
  )
