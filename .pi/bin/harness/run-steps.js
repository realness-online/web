#!/usr/bin/env node
import { spawnSync as spawn_sync } from 'node:child_process'
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

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const [kind, ...names] = process.argv.slice(2)
  for (const step of pick(kind, names)) {
    process.stdout.write(`\n== ${kind}: ${step.name} (${step.area})${step.note ? ` - ${step.note}` : ''}\n`)
    const { status } = spawn_sync(step.run, { cwd: root, shell: true, stdio: 'inherit' })
    if (status !== 0) {
      process.stderr.write(`\n${kind}: ${step.name} (${step.area}) failed\n`)
      process.exit(1)
    }
  }
}
