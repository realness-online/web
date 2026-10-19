import { browser_settings } from '../../settings/environments.js'
import { create_vm_env } from './vm-env.js'
import {
  explorer_provider,
  assistant_text,
  assistant_failure
} from './explorer-provider.js'

const DB_NAME = 'realness-explorer'

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
        browser_settings(import.meta.env.MODE).proxy_url,
        token
      )
    )
    const registry = pi.createRegistry()
    registry.install(
      pi.defineExtension({ name: 'vm-tools', tools: [pi.createBashTool()] })
    )
    harness = await pi.Harness.open(
      storage,
      {
        models,
        registry,
        env: ({ cwd }) => ({ ...remote, cwd: cwd ?? '/realness' })
      },
      pi.BACKGROUND_CONTEXT
    )
    const root = await harness.root(pi.BACKGROUND_CONTEXT, {
      agent: { model: EXPLORER_MODEL, cwd: '/realness' }
    })
    await root.configure(
      {
        instructions:
          "You are Explorer. Use bash for shell requests. Commands run on the person's VM; this browser keeps the conversation."
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
  if (open_now) return open_now
  opening ??= { database, promise: open_explorer(token, database) }
  try {
    open_now = await opening.promise
    return open_now
  } finally {
    opening = null
  }
}

/** @param {{ text: string, token: () => Promise<string>, user_id: string, on_delta?: (text: string) => void }} turn */
export const ask = async ({ text, token, user_id, on_delta = () => {} }) => {
  const { pi, harness, root } = await explorer(token, user_id)
  const stream = await pi.watchEvents(harness, root.id, pi.BACKGROUND_CONTEXT)
  stream.start(events => {
    for (const event of events)
      if (event.type === 'message_update')
        for (const change of event.changes)
          if (change.type === 'text_delta') on_delta(change.delta)
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
    return { text: latest ? assistant_text(latest) : '' }
  } finally {
    view.dispose()
  }
}

/** @param {{ token: () => Promise<string>, user_id: string }} person */
export const history = async ({ token, user_id }) => {
  const { pi, root } = await explorer(token, user_id)
  const context = await root.context(pi.BACKGROUND_CONTEXT)
  return context.messages.flatMap(message => {
    if (message.role !== 'user' && message.role !== 'assistant') return []
    const text =
      typeof message.content === 'string'
        ? message.content
        : message.content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('')
    return text ? [{ role: message.role, text }] : []
  })
}

/** @param {{ name: string, args: string, token: () => Promise<string>, user_id: string }} input */
export const command = async ({ name, args, token, user_id }) => {
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
