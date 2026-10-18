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
  watchEvents
} from '@earendil-works/pi-durable'
export { createModels, createProvider } from '@earendil-works/pi-ai'
export { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
export { openIndexedDbStorage } from 'pi-durable-storage-idb'
