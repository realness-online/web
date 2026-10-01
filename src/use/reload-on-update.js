import { onMounted, onUnmounted } from 'vue'

/**
 * Carries an open page onto a new build.
 *
 * The built worker (vite-plugin-pwa, prompt mode) installs a new build and
 * then waits: it only activates when a page posts SKIP_WAITING. Nothing did,
 * so a deploy reached nobody until every realness tab was closed. A tab left
 * open for days never even hears of the deploy: moving between routes is not
 * a page load, and only page loads make the browser look for a new worker.
 *
 * So: look for a new worker whenever the page comes back into view. The next
 * time the page is hidden with nothing working and nothing half typed - a
 * moment no one can see - tell a waiting worker to activate, and reload once
 * it controls the page. A worker another tab activated reloads the same way.
 */

const TYPING =
  'textarea, input:not([type]), input[type="text"], input[type="search"], [contenteditable="true"]'

/**
 * @param {Document} doc
 * @returns {boolean} the focused field holds text
 */
export const is_typing = doc => {
  const field = doc.activeElement
  if (!field?.matches?.(TYPING)) return false
  const text =
    field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
      ? field.value
      : field.textContent
  return Boolean(text?.trim())
}

/**
 * @param {object} options
 * @param {ServiceWorkerContainer} options.workers
 * @param {Document} options.doc
 * @param {() => boolean} options.is_working
 * @param {() => void} options.reload
 * @returns {() => void} stops listening
 */
export const watch_for_updates = ({ workers, doc, is_working, reload }) => {
  // The first install also fires controllerchange. Only a takeover of a page
  // some worker already controlled means the page is running old code.
  let controlled = Boolean(workers.controller)
  let taken_over = false
  const is_safe = () =>
    doc.visibilityState === 'hidden' && !is_working() && !is_typing(doc)
  const on_takeover = () => {
    if (controlled) taken_over = true
    controlled = true
    if (taken_over && is_safe()) reload()
  }
  const registration = () => workers.getRegistration().catch(() => undefined)
  const on_visibility = async () => {
    if (doc.visibilityState === 'visible') {
      await (await registration())?.update().catch(() => {})
      return
    }
    if (!is_safe()) return
    if (taken_over) {
      reload()
      return
    }
    // Only a page some worker controls is running a build that can be stale.
    const waiting = controlled ? (await registration())?.waiting : null
    if (waiting && is_safe()) waiting.postMessage({ type: 'SKIP_WAITING' })
  }
  workers.addEventListener('controllerchange', on_takeover)
  doc.addEventListener('visibilitychange', on_visibility)
  return () => {
    workers.removeEventListener('controllerchange', on_takeover)
    doc.removeEventListener('visibilitychange', on_visibility)
  }
}

/** @param {() => boolean} is_working */
export const use_reload_on_update = is_working => {
  const workers =
    typeof navigator === 'undefined' ? undefined : navigator.serviceWorker
  if (!workers) return
  let stop = () => {}
  onMounted(() => {
    stop = watch_for_updates({
      workers,
      doc: document,
      is_working,
      reload: () => location.reload()
    })
  })
  onUnmounted(() => stop())
}
