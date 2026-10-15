/**
 * pr3: lock a project's hosts down. Hosts take ssh only through Identity-Aware
 * Proxy (IAP), the host API only from the gate's subnet, and the default rules
 * that open ssh and RDP to the internet are removed.
 *
 *   realness <env> host lockdown            print the plan
 *   realness <env> host lockdown --apply    run it
 */

import { note } from './exec.js'
/* eslint-disable no-await-in-loop -- firewall steps run in order: narrow rules exist before wide ones close */

/** Google's published source range for IAP TCP forwarding. */
export const IAP_RANGE = '35.235.240.0/20'
/** The default network's us-central1 subnet, where the gate's VPC egress lands. */
export const GATE_RANGE = '10.128.0.0/20'
const TAG = 'realness-host'
const OPEN_DEFAULTS = [
  'default-allow-ssh',
  'default-allow-rdp',
  'default-allow-internal'
]

/** The gcloud argv lists, in order: allow the narrow paths before closing the wide ones. */
export const lockdown_plan = ({ project, gate_range = GATE_RANGE }) => {
  if (!project) throw new Error('lockdown needs a project')
  const rule = (name, ports, range) => [
    'compute',
    'firewall-rules',
    'create',
    name,
    `--project=${project}`,
    '--network=default',
    '--direction=INGRESS',
    `--allow=${ports}`,
    `--source-ranges=${range}`,
    `--target-tags=${TAG}`
  ]
  return [
    rule('realness-host-iap-ssh', 'tcp:22', IAP_RANGE),
    rule('realness-host-api', 'tcp:8080,tcp:8081', gate_range),
    ...OPEN_DEFAULTS.map(name => [
      'compute',
      'firewall-rules',
      'delete',
      name,
      `--project=${project}`,
      '--quiet'
    ])
  ]
}

/** Print the plan, or run it with `apply`; a rule that already exists is skipped. */
export const lockdown = async (
  config,
  { apply = false, run, print = line => note(line) }
) => {
  const plan = lockdown_plan(config)
  for (const argv of plan) {
    print(`${apply ? 'run' : 'would run'}: gcloud ${argv.join(' ')}`)
    if (!apply) continue
    const result = await run(argv)
    if (!result.ok && !/already exists|was not found/.test(result.err))
      throw new Error(result.err.trim().split('\n').at(-1))
  }
  return { project: config.project, applied: apply, steps: plan.length }
}
