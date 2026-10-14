/**
 * o0: a task works on one plan. Its VM reads and writes only that plan's
 * `## Syncs` folders plus the basics every task needs: plans, recent
 * history, skills and extensions, and the harness's own guidance.
 */
import { readFile as read_file } from 'node:fs/promises'
import { join } from 'node:path'
import { limit_path } from '#root/src/files/paths.js'
import { syncs_of } from './harness.js'
import { plans_path, runtime_sessions_path } from './settings.js'

/** What every task gets, whatever its plan names. */
export const TASK_BASICS = [
  '.pi/agent/sessions',
  '.pi/extensions',
  '.pi/prompts',
  '.pi/skills',
  '.ignore',
  'AGENTS.md',
  'AGENTS.local.md',
  'package.json'
]

/**
 * The folders and files a task on `plan` may touch, plan Syncs first checked.
 * A Syncs entry that escapes the harness or names a secret is refused, by name.
 */
export const task_paths = async (root, plan) => {
  const name = plan.endsWith('.md') ? plan : `${plan}.md`
  if (name.includes('/') || name.startsWith('.'))
    throw new Error(`plan must be a file name in the plans folder: ${plan}`)
  const plans = plans_path(root)
  const text = await read_file(join(root, plans, name), 'utf8').catch(error => {
    if (error.code === 'ENOENT') throw new Error(`no plan ${name} in ${plans}`)
    throw error
  })
  const listed = syncs_of(text).map(path => path.replace(/\/+$/, ''))
  const refused = listed.filter(path => !limit_path(path))
  if (refused.length)
    throw new Error(`${name} Syncs cannot include: ${refused.join(', ')}`)
  if (!listed.length)
    throw new Error(
      `${name} has no ## Syncs list; add the folders its work needs`
    )
  return [
    ...new Set([
      ...listed,
      plans,
      ...TASK_BASICS.map(path =>
        path === '.pi/agent/sessions' ? runtime_sessions_path(root) : path
      )
    ])
  ]
}
