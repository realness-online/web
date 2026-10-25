/**
 * Session gap: after a long idle gap, the next message starts a new session.
 *
 * Old sessions stay searchable through `remember`, so the new session carries
 * only a short pointer back, not the old context. Smaller sessions sync whole
 * and every turn sends fewer tokens. `/gap-new` does the same by hand.
 */

/** Idle time that starts a new session. */
export const GAP_MS = 2 * 60 * 60 * 1000
const CLIP = 400

const clip = text => (text.length > CLIP ? `${text.slice(0, CLIP)}…` : text)

const text_of = message => {
  const content = message?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join(' ')
    .trim()
}

const SPOKEN = new Set(['user', 'assistant', 'toolResult'])

/**
 * Milliseconds since the branch's last conversation message, or null when no
 * one has spoken. Pi writes setting and system entries when a session opens,
 * so only messages count.
 */
export const idle_ms = (entries, now = Date.now()) => {
  if (!entries.some(entry => entry.type === 'message' && entry.message?.role === 'user')) return null
  const spoken = entries.filter(entry => entry.type === 'message' && SPOKEN.has(entry.message?.role))
  const last = spoken
    .map(entry => Date.parse(entry.timestamp))
    .filter(time => !Number.isNaN(time))
    .at(-1)
  return last === undefined ? null : now - last
}

/** The pointer the new session starts with: where the old one lives and how it ended. */
export const gap_note = (entries, file) => {
  const messages = entries.filter(entry => entry.type === 'message')
  const last_user = messages.findLast(entry => entry.message.role === 'user')
  const last_reply = messages.findLast(entry => entry.message.role === 'assistant' && text_of(entry.message))
  const when = messages.at(-1)?.timestamp ?? 'unknown'
  const lines = [
    `This session continues ${file ?? 'an unsaved session'}, last active ${when}.`,
    'Use the remember tool to look back at it or older sessions.'
  ]
  if (last_user) lines.push(`Last request: ${clip(text_of(last_user.message))}`)
  if (last_reply) lines.push(`Last reply: ${clip(text_of(last_reply.message))}`)
  return lines.join('\n')
}

/** @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi */
export default function (pi) {
  let held = null

  const start = async (ctx, message) => {
    const entries = ctx.sessionManager.getBranch()
    const file = ctx.sessionManager.getSessionFile()
    const note = gap_note(entries, file)
    return ctx.newSession({
      parentSession: file,
      withSession: async fresh => {
        await fresh.sendMessage({ customType: 'session-gap', content: note, display: true })
        if (message) await fresh.sendUserMessage(message)
      }
    })
  }

  pi.registerCommand('gap-new', {
    description: 'Start a new session that points back to this one',
    handler: async (_args, ctx) => {
      const message = held
      held = null
      await start(ctx, message)
    }
  })

  pi.on('input', async (event, ctx) => {
    if (!['tui', 'rpc'].includes(ctx.mode) || event.source === 'extension' || event.streamingBehavior)
      return { action: 'continue' }
    if (event.text.startsWith('/')) return { action: 'continue' }
    const idle = idle_ms(ctx.sessionManager.getBranch())
    if (idle === null || idle < GAP_MS) return { action: 'continue' }
    held = event.images?.length ? [{ type: 'text', text: event.text }, ...event.images] : event.text
    setTimeout(() => {
      try {
        pi.sendUserMessage('/gap-new', { expandPromptTemplates: true })
      } catch (error) {
        held = null
        ctx.ui?.notify?.(`session-gap: ${error.message}`, 'error')
      }
    }, 0)
    return { action: 'handled' }
  })
}
