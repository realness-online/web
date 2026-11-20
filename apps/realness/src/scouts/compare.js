import {
  cpSync as cp_sync,
  mkdirSync as mkdir_sync,
  readdirSync as readdir_sync,
  symlinkSync as symlink_sync
} from 'node:fs'
import { join } from 'node:path'
import { HOUSE_MODEL } from '#root/src/proxy/agent.js'
import { with_lock } from './lock.js'
import { keep_leads } from './run.js'

const DATE_LENGTH = 10

/**
 * The model name a box runs: the house model on OpenRouter becomes
 * `realness/standard`, since a box reaches models only through the proxy.
 * @param {string} model
 * @returns {string}
 */
export const box_model_for = model =>
  model === `openrouter/${HOUSE_MODEL}` ? 'realness/standard' : model

/** A folder a comparison never shares: each side gets its own vault and scratch. */
const OWN = ['vault', 'artifacts', 'nvim.root']

/**
 * The entries a comparison root links to, so the same code runs on both sides
 * while each side writes to its own vault.
 * @param {string} harness the real harness root
 * @returns {string[]}
 */
const shared_entries = harness =>
  readdir_sync(harness).filter(name => !OWN.includes(name))

/**
 * Build one side of a comparison: a root whose code is the real harness, and
 * whose vault holds only the plan under test.
 * @param {object} options
 * @param {string} options.harness the real harness root
 * @param {string} options.root the comparison root to make
 * @param {string} options.plan the plan folder, relative to `Projects`
 */
export const side_root = ({ harness, root, plan }) => {
  mkdir_sync(join(root, 'vault', 'Projects'), { recursive: true })
  for (const name of shared_entries(harness))
    symlink_sync(join(harness, name), join(root, name))
  cp_sync(
    join(harness, 'vault', 'Projects', plan),
    join(root, 'vault', 'Projects', plan),
    {
      recursive: true,
      filter: source => !/(^|\/)(Finds|Runs|Leads)$/.test(source)
    }
  )
  return join(root, 'vault', 'Projects', plan)
}

/**
 * Save a comparison's box leads into the real plan, under the plan's own
 * lock, so a lead the plan already holds is dropped.
 * @param {{ plan_dir: string, label: string, source: string, leads: object[], person: string }} options
 */
export const save_box_leads = ({ plan_dir, label, source, leads, person }) =>
  with_lock(plan_dir, () =>
    keep_leads({
      scout_vault: plan_dir,
      label,
      date: new Date().toISOString().slice(0, DATE_LENGTH),
      source,
      leads,
      problems: [],
      person,
      now: Date.now()
    })
  )

/** A find as a comparison reads it: the url it points at, and its score. */
const find_of = item => ({
  url: String(item.url ?? '').trim(),
  score: Number(item.score ?? 0),
  org: String(item.org ?? '').trim()
})

/**
 * Two runs of one source, compared by the url each found, so a lead both sides
 * found is one row and a lead only one side found is its own.
 * @param {Record<string, string>[]} box the box's finds, as read from its page
 * @param {Record<string, string>[]} mac the Mac's finds
 */
export const compare_finds = (box, mac) => {
  const mine = box.map(find_of)
  const theirs = mac.map(find_of)
  const theirs_at = new Map(theirs.map(find => [find.url, find]))
  const both = mine
    .filter(find => theirs_at.has(find.url))
    .map(find => ({
      url: find.url,
      org: find.org || theirs_at.get(find.url)?.org,
      box_score: find.score,
      mac_score: theirs_at.get(find.url)?.score
    }))
  const mine_at = new Set(mine.map(find => find.url))
  return {
    box: mine,
    mac: theirs,
    both,
    box_only: mine.filter(find => !theirs_at.has(find.url)),
    mac_only: theirs.filter(find => !mine_at.has(find.url))
  }
}

const NAME_WIDTH = 4
const COUNT_WIDTH = 2
const TIME_WIDTH = 4
const READS_WIDTH = 3

/** One line of the table: a side's leads, its broken items, time, and model.
 * @param {string} name
 * @param {{ model: string, leads: number, problems: number, seconds: number, reads: number, failed?: string }} side
 */
const side_line = (
  name,
  { model, leads, problems, seconds, reads, failed }
) => {
  const mine = name.padEnd(NAME_WIDTH)
  if (failed) return `${mine} failed: ${failed}`
  const count = value => String(value).padStart(COUNT_WIDTH)
  return [
    mine,
    `${count(leads)} leads `,
    ` ${count(problems)} broken `,
    ` ${String(seconds).padStart(TIME_WIDTH)}s `,
    ` ${String(reads).padStart(READS_WIDTH)} reads  ${model}`
  ].join('')
}

/**
 * What a person reads when the two runs are in: the counts, then the leads each
 * side found alone, so the difference has names, not just a number.
 * @param {object} result
 * @param {{ model: string, leads: number, problems: number, seconds: number, reads: number, failed?: string }} result.box
 * @param {{ model: string, leads: number, problems: number, seconds: number, reads: number, failed?: string }} result.mac
 * @param {ReturnType<typeof compare_finds>} result.diff
 */
export const compare_lines = ({ box, mac, diff }) => {
  const names = finds => finds.map(find => find.org || find.url).join(', ')
  return [
    side_line('box', box),
    side_line('mac', mac),
    `both      ${names(diff.both) || 'none'}`,
    `box only  ${names(diff.box_only) || 'none'}`,
    `mac only  ${names(diff.mac_only) || 'none'}`
  ]
}

/** Whether the two runs agree closely enough to call the box confirmed. */
export const confirms = ({ box, mac, diff }) =>
  !box.failed &&
  !mac.failed &&
  box.leads > 0 &&
  mac.leads > 0 &&
  diff.both.length > 0
