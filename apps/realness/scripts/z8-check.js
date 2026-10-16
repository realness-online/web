/**
 * z8 live check: start the production host, wait for it to park itself, and
 * send an authenticated gate request while Compute Engine still says STOPPING.
 * Passes when the gate answers with anything but a wake failure and the host
 * is RUNNING afterward.
 *   node scripts/z8-check.js
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { env_token } from '#root/src/control/status.js'
import { environment_settings } from '#root/src/settings/environments.js'

const run = promisify(execFile)
const PROJECT = 'realness-online'
const ZONE = 'us-west2-a'
const NAME = 'realness-1'
const POLL_MS = 1000
const PARK_LIMIT_MS = 15 * 60 * 1000
const gate = environment_settings('production').services.gate_url
const origin = 'https://realness.online'

const at = start => `${((Date.now() - start) / 1000).toFixed(1)}s`
const pause = ms => new Promise(done => setTimeout(done, ms))

const status = async () =>
  (
    await run('gcloud', [
      'compute',
      'instances',
      'describe',
      NAME,
      `--project=${PROJECT}`,
      `--zone=${ZONE}`,
      '--format=value(status)'
    ])
  ).stdout.trim()

const main = async () => {
  const token = await env_token('production')()
  if (!token) throw new Error('not signed in to production; run realness login')
  const began = Date.now()
  console.log(`${at(began)} ${await status()}; starting ${NAME}`)
  await run('gcloud', [
    'compute',
    'instances',
    'start',
    NAME,
    `--project=${PROJECT}`,
    `--zone=${ZONE}`
  ])
  let last = ''
  for (;;) {
    if (Date.now() - began > PARK_LIMIT_MS)
      throw new Error('host never began parking')
    const now = await status()
    if (now !== last) console.log(`${at(began)} ${now}`)
    last = now
    if (now === 'STOPPING') break
    await pause(POLL_MS)
  }
  const sent = Date.now()
  console.log(`${at(began)} STOPPING seen; asking the gate`)
  const reply = await fetch(`${gate}/v1/actors`, {
    headers: { authorization: `Bearer ${token}`, origin }
  })
  const body = (await reply.text()).trim().slice(0, 200)
  const after = await status()
  console.log(
    `${at(began)} gate ${reply.status} after ${at(sent)}: ${body}\nhost ${after}`
  )
  const woke = reply.status !== 503 && after === 'RUNNING'
  console.log(woke ? 'z8 PASS' : 'z8 FAIL')
  process.exitCode = woke ? 0 : 1
}

await main()
