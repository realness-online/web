/**
 * Cold watch: when a turn writes the cache again, record whether the request's
 * shape changed first. A changed system prompt or tool list rewrites the cache
 * from the start; an unchanged shape means the provider dropped it.
 *
 * One page, `artifacts/prewalk/cold.html`, one item per cold turn or shape
 * change. `cold-causes.js` reads the session pages for the rest.
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cold_cache } from '../../bin/prewalk/spend.js'
import { product_import } from '../../bin/lib/product.js'

const { item_html } = await product_import('items')

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)))
export const FILE = join(root, 'artifacts/prewalk/cold.html')

/**
 * The part of a request that must stay fixed for the cache to hold: the system
 * prompt, the tool list, and the first message.
 * @param {any} payload
 */
export const shape_of = payload =>
  JSON.stringify({
    system: payload?.system ?? payload?.systemPrompt ?? null,
    tools: (payload?.tools ?? []).map(tool => tool.name ?? tool?.function?.name ?? '').sort(),
    first: payload?.messages?.[0] ?? null
  })

/** @param {string} text */
export const digest = text => createHash('sha1').update(text).digest('hex').slice(0, 12)

/** @param {string} file @param {string} at @param {Record<string, string | number>} fields */
export const record = (file, at, fields) => {
  mkdirSync(dirname(file), { recursive: true })
  appendFileSync(
    file,
    item_html('cold-watch/turn', { ...fields, at }).replace(
      'itemscope',
      `itemscope itemid="/cold-watch/turns/${at.replace(/[^0-9]/g, '')}"`
    )
  )
}

/**
 * @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi
 * @param {{ file?: string }} [where]
 */
export default function (pi, { file = FILE } = {}) {
  /** @type {string | undefined} */
  let pending
  /** @type {string | undefined} */
  let last
  /** @type {string} */
  let before = ''

  pi.on('session_start', () => {
    pending = undefined
    last = undefined
  })

  pi.on('before_provider_request', event => {
    before = digest(shape_of(event.payload))
  })

  pi.on('message_end', event => {
    const message = event.message
    if (!message || message.role !== 'assistant' || !message.usage) return
    pending = before
    const cold = cold_cache(
      message.usage.cacheRead ?? 0,
      message.usage.cacheWrite ?? 0,
      (message.usage.input ?? 0) + (message.usage.output ?? 0)
    )
    const changed = last !== undefined && pending !== last
    if (!cold && !changed) {
      last = pending
      return
    }
    record(file, new Date().toISOString(), {
      model: `${message.provider ?? ''}/${message.model ?? ''}`,
      cold: cold ? 'yes' : 'no',
      shape: changed ? 'changed' : 'same',
      read: message.usage.cacheRead ?? 0,
      write: message.usage.cacheWrite ?? 0,
      messages: message.usage.input ?? 0
    })
    last = pending
  })
}
