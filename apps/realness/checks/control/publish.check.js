#!/usr/bin/env node

import { readFileSync as read_file_sync } from 'node:fs'
import { issue_halo_pass } from '#root/src/sign-on/node/halo-pass.js'
import { person } from '#root/src/harness/settings.js'
import { secret_path } from '#root/src/settings/secrets.js'

const API = process.env.API ?? 'http://127.0.0.1:18080'
const RUNS = Number(process.env.RUNS ?? 2)
const SITE = '/realness/work/site'
const ROOT = new URL('../../../..', import.meta.url).pathname
const owner = person(ROOT)?.slice(1)

/** A halo pass for the owner, so the check may use the box. */
const pass_of = () => {
  const secret = read_file_sync(secret_path('halo-pass-secret'), 'utf8').trim()
  return issue_halo_pass({ phone: owner }, secret)
}

const exec = async (actor, command, timeout = 120) => {
  const response = await fetch(`${API}/v1/actors/${actor}/exec`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${pass_of()}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ argv: ['/bin/bash', '-lc', command], timeout })
  })
  const result = await response.json()
  if (!response.ok) throw new Error(`exec: ${result.error}`)
  const out = Buffer.from(result.stdout_b64, 'base64').toString()
  const err = Buffer.from(result.stderr_b64, 'base64').toString()
  if (result.exit_code !== 0)
    throw new Error(
      `\`${command}\` exited ${result.exit_code}: ${(err || out).slice(-400)}`
    )
  return out
}

/** The site's name, as the built index carries it. */
const carries = (actor, name) =>
  exec(actor, `cd ${SITE} && grep -q ${JSON.stringify(name)} dist/index.html`)

const run = async () => {
  let actor = null
  const step = async (label, fn) => {
    const start = Date.now()
    const value = await fn()
    console.log(`  ok ${label} (${Date.now() - start}ms)`)
    return value
  }

  try {
    await step('create an actor', async () => {
      const response = await fetch(`${API}/v1/actors`, {
        method: 'POST',
        headers: { authorization: `Bearer ${pass_of()}` }
      })
      if (!response.ok)
        throw new Error(`create: ${response.status} ${await response.text()}`)
      actor = (await response.json()).id
    })

    await step('export the site from the product', () =>
      exec(
        actor,
        `mkdir -p /realness/work && realness example static ${SITE} && cd ${SITE} && npm install --no-fund --no-audit && sync`,
        900
      )
    )

    await step('build the site', () =>
      exec(actor, `cd ${SITE} && npm run build`, 300)
    )

    await step("the built page carries the example's name", () =>
      carries(actor, 'Your Name')
    )

    const name = `P7 ${Math.random().toString(36).slice(2, 7)}`
    await step('change, rebuild', () =>
      exec(
        actor,
        `cd ${SITE} && node -e 'const f="site.json",s=JSON.parse(require("fs").readFileSync(f));s.name=process.argv[1];require("fs").writeFileSync(f,JSON.stringify(s,null,2))' ${JSON.stringify(name)} && npm run build`,
        300
      )
    )

    await step('the rebuild carries the change', () => carries(actor, name))
  } finally {
    if (actor)
      await fetch(`${API}/v1/actors/${actor}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${pass_of()}` }
      }).catch(() => {})
  }
}

const health = await fetch(`${API}/v1/health`).then(r => r.json())
if (!health.ok || !health.seed?.built || !health.seed?.matches) {
  console.error(`local halo not ready: ${JSON.stringify(health.seed)}`)
  process.exit(1)
}

let failed = false
for (let n = 1; n <= RUNS; n++) {
  console.log(`run ${n}`)
  try {
    await run()
  } catch (error) {
    failed = true
    console.error(`  FAIL ${error.message}`)
  }
}
console.log(failed ? 'p7: FAIL' : `p7: ${RUNS} clean runs passed`)
process.exit(failed ? 1 : 0)
