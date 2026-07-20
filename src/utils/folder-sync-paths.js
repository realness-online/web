/** @fileoverview Human-friendly paths for folder-sync thought export. */

/** @typedef {import('@/types').Thought} Thought */
/** @typedef {import('@/types').Statement} Statement */
/** @typedef {import('@/types').Id} Id */

import { time_of_day } from '@/utils/date'
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
 * Flat, sortable thought folder name: `2026-07-18 morning — walking to the café`
 * @param {Thought} thought
 * @returns {string}
 */
export const thought_folder_name = thought => {
  const day = as_iso_day(thought.started_at)
  const period = time_of_day(thought.started_at)
  const snippet = sanitize_path_segment(thought_snippet(thought.statements))
  const base = sanitize_path_segment(`${day} ${period}`)
  if (!snippet) return base
  return sanitize_path_segment(`${base} — ${snippet}`)
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
