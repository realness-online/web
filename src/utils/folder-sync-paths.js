/** @fileoverview Human-friendly paths for folder-sync thought export. */

/** @typedef {import('@/types').Thought} Thought */
/** @typedef {import('@/types').Statement} Statement */
/** @typedef {import('@/types').Id} Id */

import { time_of_day, weekday_name } from '@/utils/date'
import { as_created_at } from '@/utils/itemid'

const SNIPPET_MAX = 48

/**
 * @param {number | Date} date
 * @returns {string} Local calendar day as YYYY-MM-DD
 */
export const as_iso_day = date => {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * @param {number | Date} date
 * @returns {string} Local month and day as MM-DD
 */
export const as_month_day = date => {
  const d = new Date(date)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}-${day}`
}

/**
 * Strip characters that break paths or Finder browsing.
 * @param {string} text
 * @returns {string}
 */
export const sanitize_path_segment = text =>
  text
    .replace(/[/\\?%*:|"<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')

/**
 * First statement line, shortened for a folder label.
 * @param {Statement[]} statements
 * @returns {string}
 */
export const thought_snippet = statements => {
  const raw = statements.find(s => s.statement?.trim())?.statement?.trim() ?? ''
  if (!raw) return ''
  const line = raw.split(/\r?\n/, 1)[0].trim()
  if (line.length <= SNIPPET_MAX) return line
  return `${line.slice(0, SNIPPET_MAX - 1).trimEnd()}…`
}

/**
 * Sortable thought folder name, month and day first so the folder sorts by date
 * and reads by memory: `07-18 Saturday morning — walking to the café`
 *
 * No year. Past years live in a folder named for the year, and the current year
 * is the one you are standing in — writing it on all 400 folders only makes the
 * part that varies harder to find.
 * @param {Thought} thought
 * @returns {string}
 */
export const thought_folder_name = thought => {
  const day = as_month_day(thought.started_at)
  const weekday = weekday_name(thought.started_at)
  const period = time_of_day(thought.started_at)
  const snippet = sanitize_path_segment(thought_snippet(thought.statements))
  const base = sanitize_path_segment(`${day} ${weekday} ${period}`)
  if (!snippet) return base
  return sanitize_path_segment(`${base} — ${snippet}`)
}

/**
 * Where a thought folder lives under the sync root. The current year sits at
 * the root — that is the work you are still in the middle of, and it should be
 * one click away. Every year before it gets a folder of its own so a decade of
 * thoughts does not arrive as one unbrowsable list.
 * @param {Thought} thought
 * @param {number} [now]
 * @returns {string} `2024/03-18 Monday afternoon` or a bare folder name
 */
export const thought_folder_path = (thought, now = Date.now()) => {
  const name = thought_folder_name(thought)
  const year = new Date(thought.started_at).getFullYear()
  if (year === new Date(now).getFullYear()) return name
  return `${year}/${name}`
}

/**
 * Time-based poster filename inside a thought folder.
 * @param {Id} itemid
 * @param {string} [ext]
 * @returns {string}
 */
export const poster_file_name = (itemid, ext = 'svg') => {
  const created = as_created_at(itemid)
  if (!created) return `poster.${ext}`
  const d = new Date(created)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return sanitize_path_segment(
    `${as_iso_day(created)} ${time_of_day(created)} ${hh}${mm}.${ext}`
  )
}
