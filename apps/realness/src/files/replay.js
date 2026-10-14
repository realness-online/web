/**
 * Replay: when both sides changed a file and ours is nothing but session
 * `edit` calls since the last agreement, apply those same edits to theirs.
 * Each `oldText` must occur exactly once in theirs, or replay gives up and
 * sync keeps both. Never a merge: only edits a session made, verbatim.
 */
import { readFile as read_file } from 'node:fs/promises'
import { execFile as exec_file } from 'node:child_process'
import { promisify } from 'node:util'
import { MIB } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- sessions replay in order */

const OUTPUT_MIB = 128

const run = promisify(exec_file)
export const is_session_file = path => /\.(jsonl|html|html\.gz)$/.test(path)

/** The fork's reader owns HTML decoding; replay keeps its standard-library-only boundary. */
const session_text = async session => {
  if (session.endsWith('.jsonl'))
    return read_file(session, 'utf8').catch(() => '')
  if (!is_session_file(session)) return ''
  const { stdout } = await run(
    process.env.PI_SESSION_READER ?? 'pi-session-read',
    [session],
    { maxBuffer: OUTPUT_MIB * MIB }
  )
  return stdout
}

/** The edit calls behind our side, or null when anything else touched it. */
export const replayable = (rows, local_sha) => {
  if (!rows.length || rows.at(-1).sha !== local_sha) return null
  if (rows.some(row => row.tool !== 'edit' || !row.tool_call)) return null
  return rows
}

/** Tool-call arguments by id, read from each session file once. */
export const load_calls = async rows => {
  const calls = new Map()
  for (const session of new Set(rows.map(row => row.session))) {
    const text = await session_text(session)
    for (const line of text.split('\n')) {
      if (!line.includes('"toolCall"')) continue
      let entry
      try {
        entry = JSON.parse(line)
      } catch {
        continue
      }
      for (const part of entry.message?.content ?? [])
        if (part.type === 'toolCall' && part.name === 'edit')
          calls.set(part.id, part.arguments)
    }
  }
  return rows.map(row => calls.get(row.tool_call))
}

/** Apply edit-call arguments in order; null if any `oldText` is not unique. */
export const apply = (source, calls) => {
  let text = source
  for (const call of calls) {
    if (!call) return null
    const edits = call.edits ?? [
      { oldText: call.oldText, newText: call.newText }
    ]
    for (const { oldText, newText } of edits) {
      if (
        typeof oldText !== 'string' ||
        typeof newText !== 'string' ||
        !oldText
      )
        return null
      const at = text.indexOf(oldText)
      if (at === -1 || text.indexOf(oldText, at + 1) !== -1) return null
      text = text.slice(0, at) + newText + text.slice(at + oldText.length)
    }
  }
  return text
}
