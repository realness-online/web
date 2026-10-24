import { browser_settings } from '../../settings/environments.js'
import { create_vm_env } from './vm-env.js'
import { create_vm_files } from './vm-files.js'
import {
  claim_view,
  compare_tails,
  publish_view,
  upstream_note,
  watch_view
} from './explorer-view.js'
import {
  explorer_provider,
  assistant_text,
  assistant_failure
} from './explorer-provider.js'

const DB_NAME = 'realness-explorer'
const BRANCH = 'realness.branch'
const UPSTREAM = 'realness.upstream'
/** This tab's name as a writer on every device. */
const WRITER =
  globalThis.crypto?.randomUUID?.() ?? `tab-${Date.now()}-${Math.random()}`

const EXPLORER_MODEL = {
  provider: 'realness-proxy',
  modelId: 'inkling'
}

/** @typedef {{ pi: any, storage: any, harness: any, root: any, database: string, remote: ReturnType<typeof create_vm_env> }} Explorer */
/** @type {Promise<any> | null} */
let bundle = null
/** @type {Explorer | null} */
let open_now = null
/** @type {{ database: string, promise: Promise<Explorer> } | null} */
let opening = null
/** Set when another tab took this person's log; nothing reopens it until take_back. */
let taken = false
/** @type {Set<(taken: boolean) => void>} */
const watchers = new Set()
/** @type {Set<(messages: Array<{ role: string, text: string }>) => void>} */
const followers = new Set()
/** @type {BroadcastChannel | null} */
let channel = null
/** The gate view this tab last saw: who wrote, at what tail. */
/** @type {{ writer: string | null, tail: number }} */
let seen = { writer: null, tail: 0 }
/** Lines the gate held when this tab last published: the branch anchor. */
let published = 0
/** This tab committed since its last publish reached the gate. */
let local_moved = false
/** @type {AbortController | null} */
let viewing = null
/** @type {(() => Promise<string>) | null} */
let view_token = null

export class TakenError extends Error {
  name = 'TakenError'
  constructor() {
    super('Another tab is using this chat')
  }
}

const announce = value => {
  taken = value
  for (const watcher of watchers) watcher(value)
}

/** Close what this tab holds without writing; the other tab owns the log now. */
const give_up = async () => {
  if (taken) return
  announce(true)
  const session = open_now ?? (await opening?.promise.catch(() => null))
  open_now = null
  if (!session) return
  const context = session.pi.BACKGROUND_CONTEXT
  await session.harness.close(context).catch(() => {})
  await session.remote.cleanup().catch(() => {})
  await session.storage.close(context).catch(() => {})
}

const listen = database => {
  if (channel || typeof BroadcastChannel === 'undefined') return
  channel = new BroadcastChannel(DB_NAME)
  channel.onmessage = ({ data }) => {
    if (data?.claimed === database) void give_up()
    if (data?.committed === database && taken) void reread(database)
  }
}

const claim = database => {
  listen(database)
  channel?.postMessage({ claimed: database })
}

/**
 * Hear when another tab takes or this tab takes back the log.
 * @param {(taken: boolean) => void} watcher
 */
export const watch_owner = watcher => {
  watchers.add(watcher)
  watcher(taken)
  return () => watchers.delete(watcher)
}

/** Let this tab open the log again; the next call claims it. */
export const take_back = () => announce(false)

const tell = lines => {
  for (const follower of followers) follower(lines)
}

/** Publish this writer's transcript to every device; offline leaves it local. */
const publish = async () => {
  const session = open_now
  if (!session || taken || !view_token) return
  const context = session.pi.BACKGROUND_CONTEXT
  let tail
  let lines
  try {
    tail = await session.pi.readTail(session.storage, context)
    lines = to_lines(await session.pi.readTranscript(session.storage, context))
  } catch {
    return
  }
  try {
    if (session !== open_now) return
    const reply = await publish_view(view_token, {
      writer: WRITER,
      tail,
      lines
    })
    if (reply.ok) {
      seen = { writer: WRITER, tail }
      published = lines.length
      local_moved = false
    } else await arrive(reply.current)
  } catch {
    local_moved = true
  }
}

/** Keep the gate's view of another device, in case this log branches later. */
let upstream_lines = []
/** The last conversation another device published, for /upstream. */
let other = { writer: null, lines: [] }

const note_other = view => {
  if (view.writer && view.writer !== WRITER)
    other = { writer: view.writer, lines: view.lines ?? [] }
}

/** A returning or refused writer compares tails and continues, yields, or branches. */
const arrive = async found => {
  upstream_lines = found.lines ?? []
  note_other(found)
  if (taken) {
    if (found.writer && found.writer !== WRITER) tell(upstream_lines)
    return
  }
  const decision = compare_tails({ writer: WRITER, seen, local_moved }, found)
  if (decision === 'yield') {
    seen = { writer: found.writer, tail: found.tail }
    await give_up()
    tell(upstream_lines)
    return
  }
  if (decision === 'branch') await record_branch(found)
  if (view_token) await claim_view(view_token, WRITER).catch(() => {})
  await publish()
}

/** Mark this log a branch of the device that wrote while it was away. */
const record_branch = async found => {
  const session = open_now
  if (!session) return
  const context = session.pi.BACKGROUND_CONTEXT
  const submission = await session.root.submit(
    {
      type: 'write',
      entry: {
        kind: BRANCH,
        data: {
          parent: found.writer,
          parent_tail: found.tail,
          anchor: published,
          upstream: (found.lines ?? []).slice(published),
          lines: found.lines ?? []
        }
      }
    },
    context
  )
  await submission.wait(context)
}

const hear = record => {
  if (record.type === 'claimed') {
    if (record.writer === WRITER) return
    seen = { ...seen, writer: record.writer }
    void give_up()
    return
  }
  seen = { writer: record.writer, tail: record.tail }
  upstream_lines = record.lines ?? []
  note_other(record)
  if (record.writer !== WRITER && taken) tell(upstream_lines)
}

/** Follow the person's view on every device, and hold the pen there. */
const join_view = token => {
  view_token = token
  if (viewing) {
    void claim_view(token, WRITER)
      .then(() => publish())
      .catch(() => {})
    return
  }
  viewing = new AbortController()
  void watch_view(token, {
    on_open: arrive,
    on_record: hear,
    signal: viewing.signal
  })
}

const lost = async error => {
  if (error?.name !== 'OwnershipLostError') return error
  await give_up()
  return new TakenError()
}

/** @returns {Promise<any>} */
const durable = () =>
  (bundle ??= import(/* @vite-ignore */ '/pi-durable.browser.js'))

const open_explorer = async (token, database) => {
  const pi = await durable()
  const storage = await pi.openIndexedDbStorage(database)
  const remote = create_vm_env({ getIdToken: token })
  let harness
  try {
    const models = pi.createModels()
    models.setProvider(
      explorer_provider(
        pi,
        new URL(
          browser_settings(import.meta.env.MODE).proxy_url,
          globalThis.location?.href
        ).href,
        token
      )
    )
    const registry = pi.createRegistry()
    registry.install(
      pi.defineExtension({
        name: 'vm-tools',
        tools: [
          pi.createBashTool(),
          pi.createReadTool(),
          pi.createWriteTool(),
          pi.createEditTool()
        ]
      })
    )
    harness = await pi.Harness.open(
      storage,
      {
        models,
        registry,
        env: ({ cwd }) => {
          const shell = { ...remote, cwd: cwd ?? '/realness' }
          return { ...create_vm_files(pi, shell), ...shell }
        }
      },
      pi.BACKGROUND_CONTEXT
    )
    const root = await harness.root(pi.BACKGROUND_CONTEXT, {
      agent: { model: EXPLORER_MODEL, cwd: '/realness' }
    })
    await root.configure(
      {
        instructions:
          "You are Explorer. Use bash for shell requests and read, write, and edit for files. Commands and files are on the person's VM; this browser keeps the conversation."
      },
      pi.BACKGROUND_CONTEXT
    )
    return { pi, storage, harness, root, database, remote }
  } catch (error) {
    if (harness) await harness.close(pi.BACKGROUND_CONTEXT)
    await remote.cleanup()
    await storage.close(pi.BACKGROUND_CONTEXT)
    throw error
  }
}

/**
 * @param {() => Promise<string>} token
 * @param {string} user_id
 * @returns {Promise<Explorer>}
 */
export const explorer = async (token, user_id) => {
  if (!user_id) throw new Error('Explorer needs a signed-in user')
  const database = `${DB_NAME}-${encodeURIComponent(user_id)}`
  if (
    (open_now && open_now.database !== database) ||
    (opening && opening.database !== database)
  )
    throw new Error('Reload chat after changing accounts')
  if (taken) throw new TakenError()
  if (open_now) return open_now
  opening ??= { database, promise: open_explorer(token, database) }
  try {
    open_now = await opening.promise
    claim(database)
    join_view(token)
    return open_now
  } finally {
    opening = null
  }
}

/** @param {{ text: string, token: () => Promise<string>, user_id: string, on_delta?: (text: string) => void, on_thinking?: (text: string) => void }} turn */
export const ask = async turn => {
  const reply = await owned(() => answer(turn))
  share()
  return reply
}

/**
 * Hear the writer's transcript after each of its commits, while this tab reads.
 * @param {(messages: Array<{ role: string, text: string }>) => void} follower
 */
export const follow = follower => {
  followers.add(follower)
  return () => followers.delete(follower)
}

/** Tell read-only tabs the log moved; they read it themselves. */
const share = () => {
  if (!open_now) return
  channel?.postMessage({ committed: open_now.database })
  local_moved = true
  void publish()
}

/** Read the log without claiming it and hand the transcript to followers. */
const reread = async database => {
  const pi = await durable()
  const storage = await pi.openIndexedDbStorage(database, { claim: false })
  try {
    const lines = to_lines(
      await pi.readTranscript(storage, pi.BACKGROUND_CONTEXT)
    )
    if (taken) for (const follower of followers) follower(lines)
  } finally {
    await storage.close(pi.BACKGROUND_CONTEXT)
  }
}

/** @param {{ text: string, token: () => Promise<string>, user_id: string, on_delta?: (text: string) => void, on_thinking?: (text: string) => void }} turn */
const answer = async ({
  text,
  token,
  user_id,
  on_delta = () => {},
  on_thinking = () => {}
}) => {
  const { pi, harness, root } = await explorer(token, user_id)
  const stream = await pi.watchEvents(harness, root.id, pi.BACKGROUND_CONTEXT)
  stream.start(events => {
    for (const event of events)
      if (event.type === 'message_update')
        for (const change of event.changes)
          if (change.type === 'text_delta') on_delta(change.delta)
          else if (change.type === 'thinking_delta') on_thinking(change.delta)
    return Promise.resolve()
  })
  try {
    const submission = await root.submit(
      { type: 'input', content: text },
      pi.BACKGROUND_CONTEXT
    )
    await submission.wait(pi.BACKGROUND_CONTEXT)
  } finally {
    await stream.stop()
  }
  const view = await root.viewState(pi.BACKGROUND_CONTEXT)
  try {
    const failed =
      view.value.docs?.['pi.live']?.failure ??
      assistant_failure(view.value.entries)
    if (failed) throw new Error(String(failed.message ?? failed))
    const latest = view.value.entries.findLast(entry => assistant_text(entry))
    const line = to_lines(
      view.value.entries.flatMap(entry => entry.model ?? [])
    ).at(-1)
    return {
      text: latest ? assistant_text(latest) : '',
      ...(line?.thinking ? { thinking: line.thinking } : {})
    }
  } finally {
    view.dispose()
  }
}

/**
 * Run against the log, turning a lost pen into TakenError.
 * @template T
 * @param {() => Promise<T>} work
 */
const owned = async work => {
  try {
    return await work()
  } catch (error) {
    throw await lost(error)
  }
}

/** @param {{ token: () => Promise<string>, user_id: string }} person */
export const history = person => owned(() => read_history(person))

/** @param {{ token: () => Promise<string>, user_id: string }} person */
const read_history = async ({ token, user_id }) => {
  const { pi, root } = await explorer(token, user_id)
  const context = await root.context(pi.BACKGROUND_CONTEXT)
  return to_lines(context.messages)
}

/**
 * The text of one kind of content part.
 * @param {string | Array<{ type: string, text?: string, thinking?: string }>} content
 * @param {'text' | 'thinking'} type
 */
const parts = (content, type) => {
  if (typeof content === 'string') return type === 'text' ? content : ''
  return content
    .filter(part => part.type === type)
    .map(part => part[type])
    .join('')
}

/**
 * User and assistant lines. Reasoning from a step with no text, such as a tool
 * call, carries forward to the next reply.
 * @param {Array<{ role: string, content: string | Array<{ type: string, text?: string, thinking?: string }> }>} messages
 */
const to_lines = messages => {
  let carried = ''
  return messages.flatMap(message => {
    if (message.role !== 'user' && message.role !== 'assistant') return []
    const text = parts(message.content, 'text')
    if (message.role === 'user') {
      carried = ''
      return text ? [{ role: 'user', text }] : []
    }
    const thinking = carried + parts(message.content, 'thinking')
    if (!text) {
      carried = thinking
      return []
    }
    carried = ''
    return [{ role: 'assistant', text, ...(thinking ? { thinking } : {}) }]
  })
}

/** @param {{ name: string, args: string, token: () => Promise<string>, user_id: string }} input */
export const command = async input => {
  const reply = await owned(() => run_command(input))
  share()
  return reply
}

/** @param {{ name: string, args: string, token: () => Promise<string>, user_id: string }} input */
const run_command = async ({ name, args, token, user_id }) => {
  const { pi, root, harness } = await explorer(token, user_id)
  const context = pi.BACKGROUND_CONTEXT
  if (name === 'stop') {
    await root.abort(context)
    return { text: 'Stopped' }
  }
  if (name === 'new') {
    await root.abort(context)
    await root.reset(undefined, context)
    await root.waitForIdle(context)
    return { text: 'New session' }
  }
  if (name === 'compact') {
    const task = await root.compact(args || undefined, context)
    const result = await harness.waitForTask(task, context)
    if (result.status !== 'completed')
      throw new Error('Compaction did not complete')
    return { text: 'Context compacted' }
  }
  if (name === 'upstream') return adopt_upstream(root, pi, context)
  if (name === 'model') {
    if (args && args !== 'inkling' && args !== 'realness-proxy/inkling')
      throw new Error('Browser chat currently supports inkling')
    return { text: 'Model: inkling', models: ['inkling'] }
  }
  if (name === 'thinking') {
    if (args && args !== 'off')
      throw new Error('Explorer does not support thinking levels')
    return { text: 'Thinking: off' }
  }
  throw new Error(`Unknown browser command: ${name}`)
}

/** Count the opening lines two conversations share. */
const shared = (theirs, ours) => {
  let index = 0
  while (
    index < theirs.length &&
    index < ours.length &&
    theirs[index].role === ours[index].role &&
    theirs[index].text === ours[index].text
  )
    index++
  return index
}

/** The other device's conversation: the live one, else the branch's parent. */
const source = async (pi, storage, context) => {
  if (other.writer) return other
  const branch = await pi.findLatestKind(storage, [BRANCH], context)
  if (!branch) return null
  return {
    writer: branch.data.parent,
    lines: branch.data.lines ?? branch.data.upstream ?? []
  }
}

/** Append the other device's lines this conversation lacks, once, as one note. */
const adopt_upstream = async (root, pi, context) => {
  const { storage } = /** @type {Explorer} */ (open_now)
  const from = await source(pi, storage, context)
  if (!from?.lines.length) return { text: 'Nothing upstream' }
  const ours = to_lines((await root.context(context)).messages)
  const read = await pi.findLatestKind(storage, [UPSTREAM], context)
  const start = Math.max(
    shared(from.lines, ours),
    read?.data?.parent === from.writer ? (read.data.read ?? 0) : 0
  )
  const lines = from.lines.slice(start)
  if (!lines.length) return { text: 'Nothing upstream' }
  const submission = await root.submit(
    {
      type: 'write',
      entry: {
        kind: UPSTREAM,
        data: { parent: from.writer, read: from.lines.length },
        model: [
          {
            role: 'user',
            content: upstream_note(lines),
            timestamp: Date.now()
          }
        ]
      }
    },
    context
  )
  await submission.wait(context)
  return { text: `Read ${lines.length} upstream lines` }
}

export const stop = async () => {
  if (opening) await opening.promise
  if (!open_now) return
  await open_now.root.abort(open_now.pi.BACKGROUND_CONTEXT)
}

export const close = async () => {
  if (opening) await opening.promise
  if (!open_now) return
  const session = open_now
  await session.harness.close(session.pi.BACKGROUND_CONTEXT)
  await session.remote.cleanup()
  await session.storage.close(session.pi.BACKGROUND_CONTEXT)
  open_now = null
}

/** Forget ownership state between tests and sign-outs. */
export const reset_owner = () => {
  channel?.close()
  channel = null
  viewing?.abort()
  viewing = null
  view_token = null
  seen = { writer: null, tail: 0 }
  published = 0
  local_moved = false
  upstream_lines = []
  other = { writer: null, lines: [] }
  taken = false
  watchers.clear()
  followers.clear()
}
