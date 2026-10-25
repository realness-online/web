/**
 * s9 live check: wake the production halo through the gate, start an actor,
 * and have its guest answer one vsock exec with 200 KB of output, the reply
 * shape a large final sync returns. Passes when every byte arrives.
 *   node checks/halo/s9.check.js [actor-id]
 */
import { execFile as exec_file } from 'node:child_process'
import { promisify } from 'node:util'
import { env_token } from '#root/src/control/status.js'
import { environment_settings } from '#root/src/settings/environments.js'

const run = promisify(exec_file)
const PROJECT = 'realness-online'
const ZONE = 'us-west2-a'
const NAME = 'realness-1'
const BYTES = 200_000
const actor = process.argv[2] ?? 'a-dbf6a5ea7bfd'
const gate = environment_settings('production').services.gate_url
const origin = 'https://realness.online'

const ssh = command =>
  run(
    'gcloud',
    [
      'compute',
      'ssh',
      NAME,
      `--project=${PROJECT}`,
      `--zone=${ZONE}`,
      '--quiet',
      '--tunnel-through-iap',
      `--command=${command}`
    ],
    { maxBuffer: 16 * 1024 * 1024 }
  )

const probe = [
  "import { exec_in_guest } from './src/halo/vsock.js'",
  `const { code, out, err } = await exec_in_guest('/opt/fc/actors/mnt/${actor}/vsock.sock', ['head', '-c', '${BYTES}', '/dev/zero'])`,
  'console.log(JSON.stringify({ code, bytes: out.length, intact: out.every(byte => byte === 0), err: err.toString().slice(-200) }))'
].join('\n')
const encoded = Buffer.from(probe).toString('base64')

const main = async () => {
  const token = await env_token('production')()
  if (!token) throw new Error('not signed in to production; run realness login')
  console.log(`starting ${actor} through the gate`)
  const reply = await fetch(`${gate}/v1/startup`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      origin,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ actor })
  })
  const events = (await reply.text()).trim().split('\n')
  console.log(`startup ${reply.status}; last: ${events.at(-1)?.slice(0, 200)}`)
  const found = await ssh(
    `sudo touch /run/realness-hold; sudo ls /opt/fc/actors/mnt/${actor}/`
  )
  console.log(`actor dir: ${found.stdout.trim().replace(/\s+/g, ' ')}`)
  try {
    const { stdout } = await ssh(
      `cd ~/realness && echo ${encoded} | base64 -d > s9-probe.js && sudo node s9-probe.js; rm -f s9-probe.js`
    )
    const result = JSON.parse(stdout.trim().split('\n').at(-1))
    console.log(JSON.stringify(result))
    const pass = result.code === 0 && result.bytes === BYTES && result.intact
    console.log(pass ? 's9 PASS' : 's9 FAIL')
    process.exitCode = pass ? 0 : 1
  } finally {
    await ssh('sudo rm -f /run/realness-hold')
  }
}

await main()
