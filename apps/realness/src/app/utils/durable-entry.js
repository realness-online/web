/**
 * The browser entry for durable: one ES module holding the harness, model
 * access, chord contexts, the IndexedDB storage, and the session row codec.
 *
 * Built by `build:durable` into `out_path('durable')`, behind the pin in
 * `durable.lock.json`. Nothing here ships in the app's own bundle: it is
 * experimental upstream code, kept separate so a fork merge cannot silently
 * change the app.
 */
export { BACKGROUND_CONTEXT } from '@earendil-works/chord/context'
export {
  entryToHtmlLine,
  htmlLineToEntry,
  sessionHtmlToEntries
} from '@earendil-works/pi-coding-agent/session-html'
export {
  Harness,
  createRegistry,
  watchEvents,
  defineExtension
} from '@earendil-works/pi-durable'
export { createModels, createProvider } from '@earendil-works/pi-ai'
export { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
export { openIndexedDbStorage } from 'pi-durable-storage-idb'
export {
  createBashTool,
  createReadTool,
  createWriteTool,
  createEditTool
} from '@earendil-works/pi-durable/tools'
export { LineScanner } from '@earendil-works/pi-durable/env'

const ROOT = 1
const PAGE = 200

/** Every page of a scan; each page's cursor names the next. */
const scan_all = async (storage, query, cursor, context) => {
  const page = await storage.scanEntries(query, PAGE, cursor, context)
  if (page.next === undefined) return page.items
  return [
    ...page.items,
    ...(await scan_all(storage, query, page.next, context))
  ]
}

/**
 * The root conversation's active messages, read straight from storage with no
 * harness: the newest head marker, then every later non-head entry. In-place
 * edits are not applied; Explorer writes none.
 * @param {import('pi-durable-storage-idb').IndexedDbStorage} storage
 * @param {import('@earendil-works/chord').Context} context
 */
export const readTranscript = async (storage, context) => {
  if (!(await storage.conversation(ROOT, context))) return []
  const marker = await storage.findLatestHeadMarker(ROOT, undefined, context)
  const query = {
    conversationId: ROOT,
    order: 'ascending',
    ...(marker ? { minEntryId: marker.head } : {})
  }
  const range = await scan_all(storage, query, undefined, context)
  const active = marker
    ? [marker, ...range.filter(entry => entry.head === undefined)]
    : range
  return active.flatMap(entry => entry.model ?? [])
}

/**
 * The root conversation's newest entry id: the log's tail, 0 when empty.
 * @param {import('pi-durable-storage-idb').IndexedDbStorage} storage
 * @param {import('@earendil-works/chord').Context} context
 */
export const readTail = async (storage, context) => {
  if (!(await storage.conversation(ROOT, context))) return 0
  const page = await storage.scanEntries(
    { conversationId: ROOT, order: 'descending' },
    1,
    undefined,
    context
  )
  return page.items[0]?.id ?? 0
}

/**
 * The newest entry of one of `kinds`, scanning back from the tail.
 * @param {import('pi-durable-storage-idb').IndexedDbStorage} storage
 * @param {string[]} kinds
 * @param {import('@earendil-works/chord').Context} context
 */
export const findLatestKind = async (storage, kinds, context) => {
  if (!(await storage.conversation(ROOT, context))) return undefined
  const entries = await scan_all(
    storage,
    { conversationId: ROOT, order: 'descending' },
    undefined,
    context
  )
  return entries.find(entry => kinds.includes(entry.kind))
}
