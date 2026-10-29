/**
 * Chat bridge: the browser chat talks to the terminal's running Pi.
 *
 * A hosted actor runs one Pi, in its terminal. `realness-chat` connects to this
 * socket, writes one JSON line `{"message": "..."}`, and reads JSON lines back:
 * `{"type":"delta","text":...}`, then `{"type":"done"}` or `{"type":"error"}`.
 * The message becomes a turn in the terminal's own session, so both views
 * share one conversation. Nothing starts a Pi per message.
 *
 * `{"watch": true}` instead keeps the socket open as a view of the session:
 * `history` first, then `user`, `assistant`, `delta`, `assistant_end`, and
 * `working` for every turn, typed in the TUI or sent from the GUI.
 *
 * Inert outside a hosted guest, and in Pis without a UI (loops, RPC).
 */
import { readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { append_handover, handover_receipt, read_handover } from './handover.js'
import { as_skill_command, skill_names } from '../skill-alias/index.js'

const SOCKET = '/run/realness/pi-chat.sock'
const CHAT_PROMPT = '/usr/local/share/realness-chat.md'
const MAX_LINE = 16384

const send = (socket, value) => {
  if (!socket.destroyed) socket.write(JSON.stringify(value) + '\n')
}

const finish = (socket, value) => {
  send(socket, value)
  socket.end()
}

/** Plain text of a user or assistant message; tools and thinking drop out. */
export function text_of(message) {
  const content = message?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter(part => part?.type === 'text')
    .map(part => part.text)
    .join('')
}

/** The conversation as a GUI shows it: user and assistant text, in order. */
export function history_of(entries) {
  const out = []
  for (const entry of entries ?? []) {
    const role = entry?.type === 'message' ? entry.message?.role : null
    if (role !== 'user' && role !== 'assistant') continue
    const text = text_of(entry.message)
    if (text.trim()) out.push({ role, text })
  }
  return out
}

/**
 * Wire the bridge into one Pi. Returns the server so tests can close it.
 * @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi
 * @param {{ socket_path: string, chat_prompt?: string | null, handover_path?: string }} options
 */
/**
 * A shell command that only prints text: `cat` of a heredoc, `echo`, or
 * `printf`, with no redirect, pipe, or second command. In a chat turn that
 * text would reach the terminal and never the browser.
 * @param {unknown} command
 */
export const prints_only = command => {
  if (typeof command !== 'string') return false
  const text = command.trim()
  const heredoc = /^cat\s*<<-?\s*(['"]?)(\w+)\1[ \t]*\n[\s\S]*\n[ \t]*\2$/.exec(text)
  if (heredoc) return true
  if (!/^(echo|printf)\s/.test(text)) return false
  return !/[|;&<>`]|\$\(/.test(text.replace(/'[^']*'|"(?:[^"\\$`]|\\.)*"/g, ''))
}

const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
/** Registered so `new` runs with a command context; session replacement is command-only. */
const NEW_SESSION_COMMAND = 'realness-chat-new'
const HANDOVER_COMMAND = 'realness-chat-handover'
const HANDOVER_PATH = '/realness/.handover/log.json'

const model_name = model => (model ? `${model.provider}/${model.id}` : 'none')

const PRINT_REASON = 'This is a chat turn. The browser never sees tool output; write this text in your reply instead.'

export function bridge(pi, { socket_path, chat_prompt = null, handover_path = HANDOVER_PATH }) {
  /** @type {any} */
  let ctx = null
  /** The browser waiting on the current chat turn, if any. */
  let active = null
  /** Set between sendUserMessage and the turn's start. */
  let starting = false
  /** The last model error in the current chat turn, e.g. a spent quota. */
  let failure = null
  /** Sockets viewing the session. */
  const watchers = new Set()
  const broadcast = value => {
    for (const socket of watchers) send(socket, value)
  }

  pi.on('session_start', (_event, context) => {
    ctx = context
  })

  /** Sockets waiting on the new-session command. */
  const renewing = []
  pi.registerCommand(NEW_SESSION_COMMAND, {
    description: 'Start a new session for the browser chat',
    handler: async (_args, command_ctx) => {
      const waiting = renewing.splice(0)
      try {
        const { cancelled } = await command_ctx.newSession()
        for (const socket of waiting)
          finish(
            socket,
            cancelled ? { type: 'error', text: 'New session cancelled' } : { type: 'done', text: 'New session' }
          )
        if (!cancelled) broadcast({ type: 'history', messages: [] })
      } catch (error) {
        for (const socket of waiting)
          finish(socket, {
            type: 'error',
            text: error instanceof Error ? error.message : 'Pi could not start a session'
          })
      }
    }
  })

  const transfers = []
  pi.registerCommand(HANDOVER_COMMAND, {
    description: 'Continue the browser conversation in terminal Pi',
    handler: async (_args, command_ctx) => {
      const waiting = transfers.splice(0)
      if (!waiting.length) return
      try {
        const handover = read_handover(handover_path)
        let receipt = handover_receipt(command_ctx.sessionManager, handover.id)
        if (!receipt) {
          const result = await command_ctx.newSession({
            parentSession: command_ctx.sessionManager.getSessionFile?.(),
            setup: manager => append_handover(manager, handover),
            withSession: async replacement => {
              receipt = handover_receipt(replacement.sessionManager, handover.id)
            }
          })
          if (result.cancelled) throw new Error('Session handover cancelled')
        }
        if (!receipt) throw new Error('Pi did not load the browser conversation')
        for (const socket of waiting) finish(socket, { type: 'done', ...receipt })
        broadcast({ type: 'history', messages: history_of(ctx.sessionManager.getBranch()) })
      } catch (error) {
        for (const socket of waiting)
          finish(socket, { type: 'error', text: error instanceof Error ? error.message : 'Session handover failed' })
      }
    }
  })

  /** One command line from the browser: a reply, then the socket ends. */
  const commands = {
    handover: socket => {
      if (!ctx.isIdle() || active || starting)
        return finish(socket, { type: 'error', text: 'Stop Pi before handing over this session' })
      transfers.push(socket)
      pi.sendUserMessage(`/${HANDOVER_COMMAND}`, { expandPromptTemplates: true })
    },
    stop: socket => {
      if (ctx.isIdle()) return finish(socket, { type: 'done', text: 'Nothing to stop' })
      ctx.abort()
      finish(socket, { type: 'done', text: 'Stopped' })
    },
    new: socket => {
      if (!ctx.isIdle()) return finish(socket, { type: 'error', text: 'Stop Pi first' })
      renewing.push(socket)
      pi.sendUserMessage(`/${NEW_SESSION_COMMAND}`, { expandPromptTemplates: true })
    },
    compact: (socket, args) => {
      if (!ctx.isIdle()) return finish(socket, { type: 'error', text: 'Stop Pi first' })
      ctx.compact({
        customInstructions: args || undefined,
        onComplete: () => finish(socket, { type: 'done', text: 'Compacted' }),
        onError: error => finish(socket, { type: 'error', text: error?.message || 'Pi could not compact' })
      })
    },
    model: async (socket, args) => {
      const available = ctx.modelRegistry.getAvailable()
      if (!args) {
        const current = model_name(ctx.model)
        return finish(socket, {
          type: 'done',
          text: `Model: ${current}`,
          model: current,
          models: available.map(model_name)
        })
      }
      const [provider, id] = args.includes('/') ? args.split('/', 2) : [null, args]
      const model = available.find(m => m.id === id && (!provider || m.provider === provider))
      if (!model) return finish(socket, { type: 'error', text: `No model named ${args}` })
      if (!(await pi.setModel(model)))
        return finish(socket, { type: 'error', text: `${model_name(model)} has no sign-in` })
      finish(socket, { type: 'done', text: `Model: ${model_name(model)}`, model: model_name(model) })
    },
    thinking: (socket, args) => {
      if (args) {
        if (!THINKING_LEVELS.includes(args))
          return finish(socket, { type: 'error', text: `Thinking is one of ${THINKING_LEVELS.join(', ')}` })
        pi.setThinkingLevel(args)
      }
      const level = pi.getThinkingLevel()
      finish(socket, { type: 'done', text: `Thinking: ${level}`, level })
    }
  }

  pi.on('before_agent_start', event => {
    if (!starting || !chat_prompt) return
    return { systemPrompt: `${event.systemPrompt}\n\n${chat_prompt}` }
  })

  pi.on('tool_call', event => {
    if (!active || event.toolName !== 'bash') return
    if (prints_only(/** @type {any} */ (event.input)?.command)) return { block: true, reason: PRINT_REASON }
  })

  pi.on('agent_start', () => {
    starting = false
    broadcast({ type: 'working', on: true })
  })

  pi.on('message_start', event => {
    const message = /** @type {any} */ (event.message)
    if (message?.role === 'user') broadcast({ type: 'user', text: text_of(message) })
    if (message?.role === 'assistant') broadcast({ type: 'assistant' })
  })

  pi.on('message_end', event => {
    const message = /** @type {any} */ (event.message)
    if (message?.role !== 'assistant') return
    const error = message.stopReason === 'error' ? message.errorMessage || 'Pi could not reply' : null
    broadcast({ type: 'assistant_end', text: text_of(message), ...(error ? { error } : {}) })
    if (active && error) failure = error
  })

  pi.on('message_update', event => {
    const update = event.assistantMessageEvent
    if (update?.type !== 'text_delta') return
    if (active) send(active, { type: 'delta', text: update.delta })
    broadcast({ type: 'delta', text: update.delta })
  })

  pi.on('agent_settled', () => {
    broadcast({ type: 'working', on: false })
    if (!active) return
    send(active, failure ? { type: 'error', text: failure } : { type: 'done' })
    active.end()
    active = null
    failure = null
  })

  const server = createServer(socket => {
    let pending = ''
    socket.setEncoding('utf8')
    socket.on('error', () => {})
    socket.on('close', () => {
      if (active === socket) active = null
      watchers.delete(socket)
    })
    socket.on('data', chunk => {
      if (pending === null) return
      pending += chunk
      const end = pending.indexOf('\n')
      if (end < 0 && pending.length <= MAX_LINE) return
      const line = end < 0 ? pending : pending.slice(0, end)
      pending = null
      const fail = text => {
        send(socket, { type: 'error', text })
        socket.end()
      }
      let request
      try {
        request = JSON.parse(line)
      } catch {
        return fail('invalid message')
      }
      if (request?.watch === true) {
        if (!ctx) return fail('Pi is still starting')
        send(socket, { type: 'history', messages: history_of(ctx.sessionManager?.getBranch?.()) })
        if (!ctx.isIdle()) send(socket, { type: 'working', on: true })
        watchers.add(socket)
        return
      }
      if (typeof request?.command === 'string') {
        if (!ctx) return fail('Pi is still starting')
        const run = Object.hasOwn(commands, request.command) ? commands[request.command] : null
        if (!run) return fail(`Unknown command: ${request.command}`)
        const args = typeof request.args === 'string' ? request.args.trim() : ''
        return Promise.resolve(run(socket, args)).catch(error =>
          fail(error instanceof Error ? error.message : 'Pi refused the command')
        )
      }
      const message = request?.message
      if (line.length > MAX_LINE || typeof message !== 'string' || !message.trim()) return fail('invalid message')
      if (!ctx) return fail('Pi is still starting')
      /** A skill typed in the chat box runs as it would in the terminal; other text stays text. */
      const skill = as_skill_command(message, skill_names(pi.getCommands?.() ?? []))
      const content = skill ?? message
      const options = skill ? { expandPromptTemplates: true } : {}
      if (active || starting || !ctx.isIdle()) {
        pi.sendUserMessage(content, { ...options, deliverAs: 'followUp' })
        return finish(socket, { type: 'queued' })
      }
      active = socket
      starting = true
      failure = null
      try {
        pi.sendUserMessage(content, options)
      } catch (error) {
        active = null
        starting = false
        fail(error instanceof Error ? error.message : 'Pi refused the message')
      }
    })
  })

  rmSync(socket_path, { force: true })
  server.listen(socket_path)
  server.unref()
  return server
}

/** @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi */
export default function (pi) {
  if (!process.stdout.isTTY) return
  let chat_prompt
  try {
    chat_prompt = readFileSync(CHAT_PROMPT, 'utf8').trim() || null
  } catch {
    return
  }
  bridge(pi, { socket_path: SOCKET, chat_prompt })
  process.on('exit', () => rmSync(SOCKET, { force: true }))
}
