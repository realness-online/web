/**
 * gcloud and limactl, as functions rather than shell strings.
 *
 * Two things these wrappers fix, both of which were bugs in the shell versions:
 *
 * - Output is parsed as JSON. The shell scripts read `--format='value(...)'`
 *   and compared strings, which turns a missing field into an empty string and
 *   an empty string into a silent wrong answer.
 * - `--zone` is not accepted above a subcommand, so the zone and project go
 *   through gcloud's environment overrides, set here once per call.
 */
import { run, attempt, stream } from './exec.js'

/**
 * A gcloud compute call against one project and zone.
 *
 * Every method here goes through `call`, `try`, `stream` or `streamQuiet`, so
 * each one carries the project and zone. gcloud has no flag for either above a
 * subcommand, and a missing zone fails as "Underspecified resource" at the
 * point of use rather than here, so the environment is the only place to put
 * them.
 */
export const gcloud = config => {
  /** pr3: a locked-down halo takes ssh only through IAP. */
  const tunnel = args =>
    config.iap && ['ssh', 'scp'].includes(args[0])
      ? [...args, '--tunnel-through-iap']
      : args
  const env = {
    CLOUDSDK_CORE_PROJECT: config.project,
    CLOUDSDK_COMPUTE_ZONE: config.zone
  }

  return {
    env,

    /** Run `gcloud compute <args>` and return stdout. Throws on failure. */
    call: (args, options = {}) =>
      run('gcloud', ['compute', ...tunnel(args)], {
        env: { ...process.env, ...env },
        ...options
      }),

    /** As `call`, but returns { ok, out, err, code } instead of throwing. */
    try: (args, options = {}) =>
      attempt('gcloud', ['compute', ...tunnel(args)], {
        env: { ...process.env, ...env },
        ...options
      }),

    /** Run it with output going to this terminal. For anything slow. */
    stream: args =>
      stream('gcloud', ['compute', ...tunnel(args)], {
        env: { ...process.env, ...env }
      }),

    /** The argv prefix other modules build ssh and scp calls from. */
    args: args => ['compute', ...args],

    /** One line of output, trimmed. Throws if the command fails. */
    async value(args, format = 'value(status)') {
      return (await this.call([...args, `--format=${format}`])).trim()
    },

    /** Parsed JSON output. Throws if the command fails. */
    async json(args) {
      const text = await this.call([...args, '--format=json'])
      return JSON.parse(text || '[]')
    },

    /**
     * Does this resource exist? A failed describe is a no, not an error.
     *
     * Takes a full command - `["disks", "describe", name]` - not a prefix and
     * a name. A missing verb is an invalid choice to gcloud, which would then
     * read as "does not exist" and let a create fail later with a worse error.
     */
    async exists(args) {
      if (args.length < 2)
        throw new Error(
          `exists() needs a command and a name: ${args.join(' ')}`
        )
      const result = await this.try([...args, '--format=value(name)'])
      return result.ok && result.out.trim().length > 0
    },

    /** The instance's public IP, or "" if there is none. */
    async ip(name) {
      const result = await this.try([
        'instances',
        'describe',
        name,
        '--format=value(networkInterfaces[0].accessConfigs[0].natIP)'
      ])
      return result.ok ? result.out.trim() : ''
    },

    /** Run a command on the halo over ssh, output streaming. */
    ssh: (name, command) =>
      stream('gcloud', module_sshArgs(config, name, command), {
        env: { ...process.env, ...env }
      }),

    /** Build an ssh argv without running it. */
    sshArgs: (name, command) => module_sshArgs(config, name, command),

    /** scp into the halo. */
    scpArgs: (source, destination, { recurse = false } = {}) => {
      const args = ['compute', 'scp']
      if (config.zone) args.push(`--zone=${config.zone}`)
      args.push('--quiet')
      if (recurse) args.push('--recurse')
      if (config.iap) args.push('--tunnel-through-iap')
      args.push(source, destination)
      return args
    }
  }
}

/** ssh argv, shared by the streaming and non-streaming forms. */
const module_sshArgs = (config, name, command) => {
  const args = ['compute', 'ssh', name]
  if (config.zone) args.push(`--zone=${config.zone}`)
  args.push('--quiet', `--command=${command}`)
  if (config.iap) args.push('--tunnel-through-iap')
  return args
}
