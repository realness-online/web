import { ref } from 'vue'
import { start_actor } from '@/utils/gate'
import { readable_error } from '@/utils/chat'

const NOT_FOUND = 404
const UNAVAILABLE = 503
const RETRY_MS = 5000

/** Resolves after `ms`, or rejects when `signal` aborts. */
const pause = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Startup cancelled', 'AbortError'))
      },
      { once: true }
    )
  })

/**
 * One startup observer per pane; Retry rejoins a live job, never fabricates stages.
 * @param {import('vue').Ref<any>} user
 * @param {{set_working?: (active: boolean) => void}} [options]
 */
export const use_actor_startup = (user, { set_working = () => {} } = {}) => {
  const actor = ref(/** @type {string | null} */ (null))
  const startup_id = ref(/** @type {string | null} */ (null))
  const progress = ref(/** @type {any} */ (null))
  const finding = ref(false)
  const problem = ref('')
  /** @type {AbortController | null} */
  let controller = null
  /** @type {Promise<any> | null} */
  let pending = null
  let stopped = false
  let completed = false

  /** @param {string} [target] */
  const prepare = target => {
    if (stopped)
      return Promise.reject(new DOMException('Startup cancelled', 'AbortError'))
    if (pending) return pending
    if (completed) {
      startup_id.value = null
      progress.value = null
      completed = false
    }
    const observing = new AbortController()
    controller = observing
    finding.value = true
    problem.value = ''
    set_working(true)
    let failed = false
    const on_progress = event => {
      if (stopped || controller !== observing) return
      if (event.source === 'gate') {
        progress.value = event
        return
      }
      startup_id.value = event.startup_id
      if (event.type === 'startup') progress.value = null
      if (event.type === 'startup-stage')
        progress.value = { ...event, source: 'halo' }
      if (event.type === 'error') failed = true
    }
    const ask = () =>
      start_actor(user.value, {
        actor: target,
        startup_id: startup_id.value ?? undefined,
        signal: observing.signal,
        on_progress
      })
    /** While Realness is not answering yet, say why and ask again. */
    const request = async () => {
      for (;;)
        try {
          const ready = await ask()
          problem.value = ''
          return ready
        } catch (error) {
          if (error.status !== UNAVAILABLE || observing.signal.aborted)
            throw error
          problem.value = readable_error(error.message)
          await pause(RETRY_MS, observing.signal)
        }
    }
    pending = (async () => {
      try {
        let ready
        try {
          ready = await request()
        } catch (error) {
          if (
            error.status !== NOT_FOUND ||
            !startup_id.value ||
            observing.signal.aborted
          )
            throw error
          startup_id.value = null
          progress.value = null
          ready = await request()
        }
        if (stopped || observing.signal.aborted)
          throw new DOMException('Startup cancelled', 'AbortError')
        completed = true
        actor.value = ready.id
        startup_id.value = ready.startup_id
        return ready
      } catch (error) {
        if (!stopped && !observing.signal.aborted) {
          problem.value = readable_error(error.message)
          if (failed) startup_id.value = null
        }
        throw error
      } finally {
        if (controller === observing) {
          controller = null
          pending = null
          finding.value = false
          set_working(false)
        }
      }
    })()
    return pending
  }

  return {
    actor,
    startup_id,
    progress,
    finding,
    problem,
    prepare,
    stop() {
      stopped = true
      controller?.abort()
      controller = null
      if (finding.value) set_working(false)
      finding.value = false
    }
  }
}
