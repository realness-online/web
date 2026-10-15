import { gate_api, gate_fetch } from '@/utils/gate'
import { records } from '@/utils/stream-records'

const chat_path = (actor, what) =>
  `/v1/actors/${encodeURIComponent(actor)}/chat/${what}`

/**
 * History first, then every turn from the GUI or the TUI, until aborted.
 * @param {any} user
 * @param {string} actor
 * @param {{ signal?: AbortSignal }} [options]
 */
export const watch_chat = async (user, actor, options = {}) =>
  records(
    (
      await gate_fetch(user, chat_path(actor, 'events'), {
        signal: options.signal
      })
    ).body
  )

/**
 * Hand Pi a message; resolves 'done' when the turn ends, or 'queued' when Pi
 * was working and took it as a follow-up. Throws on a turn error.
 */
export const send_chat = async (user, actor, message) => {
  const response = await gate_fetch(user, chat_path(actor, 'message'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message })
  })
  let outcome = 'done'
  for await (const record of records(response.body)) {
    if (record.type === 'error') throw new Error(record.text)
    if (record.type === 'queued') outcome = 'queued'
  }
  return outcome
}

/** Run one chat command in the terminal's Pi; resolves its reply record. */
export const run_chat_command = async (user, actor, command, args = '') => {
  const response = await gate_fetch(user, chat_path(actor, 'command'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ command, args })
  })
  let reply = null
  for await (const record of records(response.body)) {
    if (record.type === 'error') throw new Error(record.text)
    reply = record
  }
  return reply
}

/** The proxy's warning near a model-use limit, or null. */
export const chat_warning = async (user, actor) => {
  try {
    const { warn } = await gate_api(user, chat_path(actor, 'limit'))
    return warn?.message ? warn : null
  } catch {
    return null
  }
}

export const readable_error = text => {
  let message = text
  try {
    message = JSON.parse(text.replace(/^\d{3}:\s*/, '')).message ?? text
  } catch {}
  return message.replace(/: quota exceeded\./, '.')
}
