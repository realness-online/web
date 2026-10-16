import { current_user } from '@/utils/serverless'
import { create_startup_trace } from '../../harness/startup.js'
import {
  chat_warning,
  readable_error,
  run_chat_command,
  send_chat,
  watch_chat
} from '@/utils/chat'
import { chat_commands, parse_chat_command } from '@/utils/chat-commands'
import { computed, ref } from 'vue'
import {
  contextual_message,
  read_contextual_message
} from '@/utils/chat-context'

const RECONNECT_MS = 2000
const START_TIMEOUT_MS = 60_000
const STARTUP_EVENT_LIMIT = 100
const PI_NOT_READY = 'Pi is not running in the terminal'
const DAY = 10

/** What a command's reply says in the status line. */
const reply_status = reply =>
  reply?.models
    ? `${reply.text}. Available: ${reply.models.join(', ')}`
    : (reply?.text ?? '')

/**
 * Chat commands run against the actor and report through the status line.
 * Reloading the view after \`/new\` needs the messages ref, so the setter comes in.
 * @param {{ actor: import('vue').Ref<string | null>, messages: { value: Array<{ sender: string, text: string }> }, status: { value: string }, set_messages: (next: never[]) => void }} options
 */
const make_command_runner = ({ actor, messages, status, set_messages }) => {
  const last_reply = () =>
    messages.value.findLast(message => message.sender === 'Realness')?.text

  /** Run a command and report it; resolves false when it failed. */
  return async command => {
    status.value = ''
    try {
      if (command.name === 'copy') {
        const reply = last_reply()
        if (!reply) throw new Error('No reply to copy')
        await navigator.clipboard.writeText(reply)
        status.value = 'Copied'
        return
      }
      const reply = await run_chat_command(
        current_user.value,
        actor.value,
        command.name,
        command.args
      )
      if (command.name === 'new') set_messages([])
      status.value = reply_status(reply)
    } catch (thrown) {
      status.value = readable_error(thrown.message)
      return false
    }
    return true
  }
}

/**
 * A message handed over while the host is still waking: held in the composer,
 * announced in the status line, and sent the moment history proves Pi answers.
 * @param {{ actor: { value: string | null }, draft: { value: string }, status: { value: string }, open_watch: () => Promise<unknown> }} options
 */
const make_waiting = ({ actor, draft, status, open_watch }) => {
  const waiting = ref(false)
  /** @type {{ text: string, context: object | null } | null} */
  let held = null

  const deliver = async () => {
    if (!held) return
    const message = held
    held = null
    waiting.value = false
    if (draft.value === message.text) draft.value = ''
    try {
      const outcome = await send_chat(
        current_user.value,
        actor.value,
        contextual_message(message.text, message.context)
      )
      status.value = outcome === 'queued' ? 'Queued for after this turn' : ''
    } catch (thrown) {
      status.value = readable_error(thrown.message)
      if (!draft.value) draft.value = message.text
    }
  }

  return {
    waiting,
    /** Keep the message; it stays in the composer until the host answers. */
    hold(text, context) {
      held = { text, context }
      draft.value = text
      waiting.value = true
      status.value = 'Sending when the host is up'
      void open_watch()
    },
    deliver,
    clear() {
      held = null
      waiting.value = false
    }
  }
}

/** Keep initial bridge readiness separate from failures after Pi has started. */
const create_startup_status = (status, set_working, get_startup_id) => {
  const starting = ref(false)
  const events = ref(
    /** @type {import('../../harness/startup.js').StartupEvent[]} */ ([])
  )
  const make_trace = id =>
    create_startup_trace({
      id,
      report: event => {
        if (events.value.length === STARTUP_EVENT_LIMIT) events.value.shift()
        events.value.push({ ...event, source: 'chat' })
      }
    })
  let trace = make_trace(get_startup_id() ?? crypto.randomUUID())
  /** @type {ReturnType<typeof trace.begin> | null} */
  let finish = null
  /** @type {number | null} */
  let started = null
  const ready = ref(false)
  let problem = ''
  const set_starting = active => {
    if (starting.value === active) return
    starting.value = active
    set_working(active)
  }
  return {
    starting,
    events,
    /** Whether the bridge has answered at least once. */
    ready_now: () => ready.value,
    connection_problem: computed(() =>
      !ready.value && events.value.at(-1)?.state === 'failed'
        ? status.value
        : ''
    ),
    get id() {
      return trace.id
    },
    begin() {
      const requested = get_startup_id()
      if (requested && requested !== trace.id) {
        finish?.('cancelled')
        trace = make_trace(requested)
        finish = null
      }
      if (!finish) finish = trace.begin('connecting_chat')
      if (started !== null) return
      started = Date.now()
      status.value = 'Starting...'
      set_starting(true)
    },
    ready() {
      finish?.()
      finish = null
      ready.value = true
      if (status.value === 'Starting...' || status.value === problem)
        status.value = ''
      problem = ''
      set_starting(false)
    },
    failed(message) {
      problem = readable_error(message)
      const awaiting_pi =
        !ready.value &&
        problem === PI_NOT_READY &&
        started !== null &&
        Date.now() - started < START_TIMEOUT_MS
      status.value = awaiting_pi ? 'Starting...' : problem
      if (!awaiting_pi) {
        finish?.('failed')
        finish = null
      }
      set_starting(awaiting_pi)
    },
    retry() {
      finish?.('cancelled')
      finish = null
      started = null
      problem = ''
      set_starting(false)
    },
    stop() {
      finish?.('cancelled')
      finish = null
      set_starting(false)
    }
  }
}

/**
 * The actor's one Pi session as a conversation: the watch draws both sides
 * of every turn, and sending hands Pi the message with its page snapshot.
 * @param {import('vue').Ref<string | null>} actor
 * @param {{ on_change?: () => void, get_context?: () => {path: string, title: string, text: string} | null, set_working?: (active: boolean) => void, get_startup_id?: () => string | null }} [options]
 */
export const use_chat = (
  actor,
  {
    on_change = () => {},
    get_context = () => null,
    set_working = () => {},
    get_startup_id = () => null
  } = {}
) => {
  const messages = ref(
    /** @type {Array<{sender: string, text: string, context?: {path: string, title: string, text?: string}}>} */ ([])
  )
  const draft = ref('')
  const status = ref('')
  const working = ref(false)
  const startup = create_startup_status(status, set_working, get_startup_id)
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  const waiting_state = make_waiting({
    actor,
    draft,
    status,
    open_watch: () => (in_flight ? undefined : watch())
  })
  let in_flight = false
  let watch_timer = undefined
  let watch_generation = 0
  /** @type {AbortController | null} */
  let watching = null
  let stopped = false

  /** Near a model-use limit, say so once per step per day. */
  const check_limit = async () => {
    const warn = await chat_warning(current_user.value, actor.value)
    if (!warn) return
    const day = new Date().toISOString().slice(0, DAY)
    const key = `realness-warned ${day} ${warn.limit} ${warn.at ?? ''}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    status.value = warn.message
  }

  /** One watch record onto the page; returns the reply still streaming. */
  const apply = (record, streaming) => {
    let reply = streaming
    if (record.type === 'history') {
      startup.ready()
      void waiting_state.deliver()
      messages.value = record.messages.map(message => ({
        sender: message.role === 'user' ? 'You' : 'Realness',
        ...(message.role === 'user'
          ? read_contextual_message(message.text)
          : { text: message.text })
      }))
    }
    if (record.type === 'working') working.value = record.on
    if (record.type === 'user')
      messages.value.push({
        sender: 'You',
        ...read_contextual_message(record.text)
      })
    if (record.type === 'delta') {
      if (!reply) {
        messages.value.push({ sender: 'Realness', text: '' })
        reply = messages.value.at(-1)
      }
      reply.text += record.text
    }
    if (record.type === 'assistant_end') {
      if (!record.text.trim()) {
        if (reply) messages.value.splice(messages.value.indexOf(reply), 1)
      } else if (reply) reply.text = record.text
      else messages.value.push({ sender: 'Realness', text: record.text })
      if (record.error) status.value = readable_error(record.error)
      else check_limit()
      return null
    }
    if (record.type === 'assistant') return null
    if (record.type === 'error') throw new Error(record.text)
    return reply
  }

  const watch = async () => {
    const actor_id = actor.value
    if (stopped || !actor_id) return
    const generation = ++watch_generation
    clearTimeout(watch_timer)
    watching?.abort()
    startup.begin()
    watching = new AbortController()
    let reply = null
    in_flight = true
    try {
      const records = await watch_chat(current_user.value, actor_id, {
        signal: watching.signal
      })
      for await (const record of records) {
        if (stopped || generation !== watch_generation) return
        reply = apply(record, reply)
        on_change()
      }
    } catch (thrown) {
      if (stopped || generation !== watch_generation) return
      startup.failed(thrown.message)
    } finally {
      if (generation === watch_generation) in_flight = false
    }
    if (stopped || generation !== watch_generation) return
    working.value = false
    watch_timer = setTimeout(watch, RECONNECT_MS)
  }

  const run = make_command_runner({
    actor,
    messages,
    status,
    set_messages: next => {
      messages.value = next
    }
  })

  /**
   * A command runs now; an ordinary message waits for the host when it is still
   * waking. Returns the text to send, or null when nothing is left to send.
   */
  const prepare = async message => {
    const command = parse_chat_command(message)
    if (command?.unknown) {
      status.value = `Unknown command /${command.name}. Try ${chat_commands.map(known => `/${known.name}`).join(', ')}`
      return null
    }
    if (command) {
      draft.value = ''
      if (!(await run(command)) && !draft.value) draft.value = message
      return null
    }
    const context = get_context()
    const sent_message = contextual_message(message, context)
    if (startup.ready_now()) return sent_message
    waiting_state.hold(message, context)
    return null
  }

  const send = async () => {
    const message = draft.value.trim()
    if (!message || !actor.value) return
    const previous_messages = new Set(messages.value)
    const sent_message = await prepare(message)
    if (!sent_message) return
    draft.value = ''
    status.value = ''
    try {
      const outcome = await send_chat(
        current_user.value,
        actor.value,
        sent_message
      )
      if (outcome === 'queued') status.value = 'Queued for after this turn'
    } catch (thrown) {
      status.value = readable_error(thrown.message)
      const accepted = messages.value.some(
        entry =>
          !previous_messages.has(entry) &&
          entry.sender === 'You' &&
          entry.text === message
      )
      if (!accepted && !draft.value) draft.value = message
    }
  }

  const retry = () => {
    startup.retry()
    return watch()
  }

  const stop = () => {
    stopped = true
    waiting_state.clear()
    clearTimeout(watch_timer)
    watching?.abort()
    startup.stop()
  }

  return {
    messages,
    draft,
    status,
    working,
    starting: startup.starting,
    waiting: waiting_state.waiting,
    get startup_id() {
      return startup.id
    },
    startup_events: startup.events,
    connection_problem: startup.connection_problem,
    watch,
    retry,
    send,
    /** Clear the view; Pi's history remains. */
    clear() {
      messages.value = []
    },
    stop
  }
}
