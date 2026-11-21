/**
 * v1: the planning index. A plan is a note in `Projects/` or
 * `Archive/Projects/`, a file or a folder's
 * `index.md`, whose itemid names a plan. Its summary comes from the note alone:
 * title, area, first diagram, and how many nodes stand in each state.
 */

import { read_frontmatter } from './frontmatter.js'

const AREAS = {
  art: 'Art',
  blog: 'Blog',
  music: 'Music',
  planning: 'Planning',
  realness: 'Realness',
  seeq: 'SEEQ',
  scouts: 'Scouts'
}

const PLAN_PATH = /^(?:Archive\/)?Projects\/(?:[^/]+\.md|[^/]+\/index\.md)$/

/**
 * @typedef {{ itemid: string, path: string, title: string, area: string, scout: boolean, archived: boolean, diagram: string | null, nodes: { open: number, done: number, active: string[], blocked: string[] } }} PlanSummary
 */

/**
 * A plan's area: the prefix of its file or folder name.
 * @param {string} path vault path under `Projects/`
 * @returns {string}
 */
export const area_of = path => {
  const key = path
    .replace(/^Archive\//, '')
    .split('/')[1]
    .replace(/\.md$/, '')
    .split('-')[0]
    .toLowerCase()
  return AREAS[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

/**
 * The node ids a diagram's `class` lines put in one state.
 * @param {string} diagram
 * @param {string} state
 * @returns {string[]}
 */
const in_state = (diagram, state) =>
  [
    ...diagram.matchAll(
      new RegExp(`^\\s*class\\s+([\\w,]+)\\s+${state};`, 'gm')
    )
  ].flatMap(([, ids]) => ids.split(','))

/**
 * One plan's summary, or null when the note is not a plan.
 * @param {string} path vault path
 * @param {string} raw the note's whole text
 * @param {boolean} [scout] whether a `scout.html` sits beside the plan
 * @returns {PlanSummary | null}
 */
export const plan_summary = (path, raw, scout = false) => {
  if (!PLAN_PATH.test(path)) return null
  const { data, body } = read_frontmatter(raw)
  const itemid = data.itemid ? String(data.itemid) : ''
  if (!itemid.includes('/plans/')) return null
  const diagram = /```mermaid\n([\s\S]*?)```/.exec(body)?.[1] ?? null
  const nodes = body.match(/^## Nodes\n([\s\S]*?)(?=^## )/m)?.[1] ?? ''
  const rows = nodes
    .split('\n')
    .filter(
      line =>
        /^\|\s*(?:~~)?[a-z]+\w*(?:~~)?/i.test(line) &&
        !/^\|\s*Node\b/i.test(line)
    )
  const done = rows.filter(line => /^\|\s*~~/.test(line)).length
  return {
    itemid,
    path,
    title: /^# (.+)$/m.exec(body)?.[1].trim() ?? path,
    area: area_of(path),
    scout,
    archived: path.startsWith('Archive/') || String(data.archived) === 'true',
    diagram,
    nodes: {
      open: rows.length - done,
      done,
      active: diagram ? in_state(diagram, 'active') : [],
      blocked: diagram ? in_state(diagram, 'blocked') : []
    }
  }
}
