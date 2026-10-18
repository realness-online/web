/**
 * Explorer in the tab: one durable harness over IndexedDB, so a person can talk
 * before any actor exists. Model calls go straight to the proxy with the
 * signed-in person's token, so nothing waits on the gate or a live actor.
 *
 * A turn that needs bash ends with a tool error, because this harness has no
 * environment. That error is the signal to hand over: `hand_over` closes the
 * tab's harness and returns its log, which an actor imports and continues from.
 */
import { browser_settings } from '../../settings/environments.js'
import { gate_url } from './gate.js'
import { needs_actor } from './session-handover.js'
import {
  explorer_provider,
  assistant_text,
  assistant_failure
} from './explorer-provider.js'
import { export_log, import_log, open_db } from './session-log.js'

const DB_NAME = 'realness-explorer'
const BUNDLE = 'pi-durable.browser.js'

const proxy_url = () => browser_settings(import.meta.env.MODE).proxy_url

/** The model Explorer runs on until an actor takes over. */
export const EXPLORER_MODEL = {
  provider: 'realness-proxy',
  modelId: 'inkling'
}

/** @typedef {{ pi: object, storage: object, harness: object, root: object, database: string }} Explorer */

/** @type {Promise<object> | null} */
let bundle = null
/** @type {Explorer | null} */
let open_now = null

/** The durable bundle, built by `npm run build:durable` and loaded on first use. */
const durable = () => (bundle ??= import(/* @vite-ignore */ `/${BUNDLE}`))

/**
 * The proxy as a pi-ai provider. The bearer is the person's Firebase token,
 * resolved per call so a refresh is picked up.
 * @param {() => Promise<string>} token
 * @param {object} pi the bundle's exports
 */
const proxy_provider = (token, pi) => explorer_provider(pi, proxy_url(), token)

/**
 * Open the tab's harness, or return the one already open.
 * @param {() => Promise<string>} token
 * @param {string} user_id
 * @returns {Promise<Explorer>}
 */
export const explorer = async (token, user_id) => {
  if (!user_id) throw new Error('Explorer needs a signed-in user')
  const database = `${DB_NAME}-${encodeURIComponent(user_id)}`
  if (open_now) {
    if (open_now.database !== database)
      throw new Error('Reload chat after changing accounts')
    return open_now
  }
  const pi = await durable()
  const storage = await pi.openIndexedDbStorage(database)
  const models = pi.createModels()
  models.setProvider(proxy_provider(token, pi))
  const registry = pi.createRegistry()
  registry.install(
    pi.defineExtension({ name: 'vm-tools', tools: [pi.createBashTool()] })
  )
  const harness = await pi.Harness.open(
    storage,
    { models, registry },
    pi.BACKGROUND_CONTEXT
  )
  const root = await harness.root(pi.BACKGROUND_CONTEXT, {
    agent: { model: EXPLORER_MODEL }
  })
  open_now = { pi, storage, harness, root, database }
  return open_now
}

/**
 * One Explorer turn in the tab. Resolves the assistant's text, or a log to hand
 * over when the turn needed something only an actor has.
 * @param {{ text: string, token: () => Promise<string>, user_id: string, on_delta?: (text: string) => void }} turn
 */
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
  const { value } = view
  const wanted_env = needs_actor(value)
  const reply = last_reply(value.entries)
  const failed =
    value.docs?.['pi.live']?.failure ?? assistant_failure(value.entries)
  view.dispose()
  if (wanted_env) return { hand_over: await hand_over() }
  if (failed) throw new Error(String(failed.message ?? failed))
  return { text: reply }
}

/** The newest assistant text among committed entries. */
const last_reply = entries => {
  for (let at = entries.length - 1; at >= 0; at -= 1) {
    const text = assistant_text(entries[at])
    if (text) return text
  }
  return ''
}

/**
 * Close the tab's harness and return its log, so an actor imports it and
 * continues at the tail. The tab stops writing once this resolves.
 */
export const hand_over = async () => {
  if (!open_now) throw new Error('No session to hand over')
  const { pi, storage, harness, database, root } = open_now
  await harness.close(pi.BACKGROUND_CONTEXT)
  await storage.close(pi.BACKGROUND_CONTEXT)
  open_now = null
  const db = await open_db(database)
  const log = await export_log(db)
  db.close()
  return { ...log, conversation_id: root.id, handover_id: crypto.randomUUID() }
}

/**
 * Put a log back into the tab's database, the actor side of a handover the
 * other way. Also what a test uses to prove a round trip.
 * @param {object} log
 * @param {string} user_id
 */
export const receive = async (log, user_id) => {
  if (!user_id) throw new Error('Explorer needs a signed-in user')
  if (open_now) throw new Error('Close Explorer before importing a session')
  const database = `${DB_NAME}-${encodeURIComponent(user_id)}`
  const pi = await durable()
  const storage = await pi.openIndexedDbStorage(database)
  await storage.close(pi.BACKGROUND_CONTEXT)
  const db = await open_db(database)
  const written = await import_log(db, log)
  db.close()
  return written
}

/** Forget the open harness, so a reload starts clean. */
export const reset = () => {
  open_now = null
}

/**
 * Send the tab's log to an actor so it continues the same session. The actor
 * imports it at the tail, then answers; a failure here leaves the message to
 * travel on its own, which the actor treats as a fresh turn.
 * @param {{ getIdToken: () => Promise<string> }} user
 * @param {string} actor
 * @param {object} log
 */
export const give_log = async (user, actor, log) => {
  const response = await fetch(
    `${gate_url()}/v1/actors/${encodeURIComponent(actor)}/session/log`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${await user.getIdToken()}`
      },
      body: JSON.stringify(log)
    }
  )
  if (!response.ok)
    throw new Error(`The machine did not take the session: ${response.status}`)
  return response.json()
}
