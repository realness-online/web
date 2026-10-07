/* r2d: chat with the person's actor through the gate. The host speaks
   newline-delimited JSON; records() reads it however the chunks split. */
import { gate_api, gate_fetch } from '@/utils/brayness-gate'
import { records } from '../../chat/stream.js'

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

/** Hand Pi a message; resolves when the turn ends, throws on a turn error. */
export const send_chat = async (user, actor, message) => {
  const response = await gate_fetch(user, chat_path(actor, 'message'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message })
  })
  for await (const record of records(response.body))
    if (record.type === 'error') throw new Error(record.text)
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

/* Pi reports a refused call as `429: {"message": ...}`; show only the
   message. "quota exceeded" is there for Pi, so it never retries. */
export const readable_error = text => {
  let message = text
  try {
    message = JSON.parse(text.replace(/^\d{3}:\s*/, '')).message ?? text
  } catch {
    /* plain text already */
  }
  return message.replace(/: quota exceeded\./, '.')
}
