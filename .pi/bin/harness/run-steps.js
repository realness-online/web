#!/usr/bin/env node
import { spawnSync as spawn_sync } from 'node:child_process'
import { connect } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { steps } from './steps.js'

const root = resolve(file_url_to_path(new URL('../../..', import.meta.url)))

/**
 * Steps of one kind, all of them or only those named.
 * @param {keyof typeof steps} kind
 * @param {string[]} names
 */
export const pick = (kind, names) => {
  const list = steps[kind]
  if (!list) throw new Error(`unknown kind: ${kind}; use ${Object.keys(steps).join(', ')}`)
  if (!names.length) return list
  const unknown = names.filter(name => !list.some(step => step.name === name))
  if (unknown.length) throw new Error(`unknown ${kind} step: ${unknown.join(', ')}`)
  return list.filter(step => names.includes(step.name))
}

const LOCAL_HALO = '127.0.0.1:18080'
const START_HALO = 'npm --prefix apps/realness run realness -- local halo up'

/** The halo API the live checks use, as their own `API` default. */
export const halo_api = (env = process.env) => new URL(env.API ?? `http://${LOCAL_HALO}`)

/**
 * Whether something listens at `url`, within `ms`.
 * @param {URL} url
 * @param {number} [ms]
 * @returns {Promise<boolean>}
 */
export const listening = (url, ms = 2000) =>
  new Promise(done => {
    const socket = connect({ host: url.hostname, port: Number(url.port) || 80, timeout: ms })
    const end = up => {
      socket.destroy()
      done(up)
    }
    socket.once('connect', () => end(true))
    socket.once('timeout', () => end(false))
    socket.once('error', () => end(false))
  })

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const [kind, ...names] = process.argv.slice(2)
  const list = pick(kind, names)
  if (list.some(step => step.needs === 'halo')) {
    const api = halo_api()
    if (!(await listening(api)) && api.host === LOCAL_HALO) {
      process.stdout.write(`\n== no halo at ${api.host}; starting the local halo\n`)
      spawn_sync(START_HALO, { cwd: root, shell: true, stdio: 'inherit' })
    }
    if (!(await listening(api))) {
      process.stderr.write(`\nno halo answers at ${api.host}\nstart it: ${START_HALO}\n`)
      process.exit(1)
    }
  }
  for (const step of list) {
    process.stdout.write(`\n== ${kind}: ${step.name} (${step.area})${step.note ? ` - ${step.note}` : ''}\n`)
    const { status } = spawn_sync(step.run, { cwd: root, shell: true, stdio: 'inherit' })
    if (status !== 0) {
      process.stderr.write(`\n${kind}: ${step.name} (${step.area}) failed\n`)
      process.exit(1)
    }
  }
}
