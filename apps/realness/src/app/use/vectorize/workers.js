import { ref } from 'vue'

/**
 * Worker pool for vectorization pipeline stages.
 * Handles mount/unmount lifecycle for vectorizer, gradienter, tracer, and optimizer.
 * Handlers are set via `set_handlers()` and used lazily at mount time.
 */
export const use_workers = () => {
  const vectorizer = ref(/** @type {Worker | null} */ (null))
  const gradienter = ref(/** @type {Worker | null} */ (null))
  const tracer = ref(/** @type {Worker | null} */ (null))
  const optimizer = ref(/** @type {Worker | null} */ (null))
  const workers_mounted = ref(false)

  /** @type {{ vectorized?: EventListener, gradientized?: EventListener, traced?: EventListener, optimized?: EventListener }} */
  let _handlers = {}

  const set_handlers = handlers => {
    _handlers = handlers
  }

  const terminate_one = worker_ref => {
    const w = worker_ref.value
    if (!w) return
    w.terminate()
    worker_ref.value = null
  }

  const mount_workers = () => {
    if (workers_mounted.value) return

    terminate_one(vectorizer)
    terminate_one(gradienter)
    terminate_one(tracer)
    terminate_one(optimizer)

    vectorizer.value = new Worker('/vector.worker.js')
    gradienter.value = new Worker('/vector.worker.js')
    tracer.value = new Worker('/tracer.worker.js')
    optimizer.value = new Worker('/vector.worker.js')

    if (vectorizer.value && _handlers.vectorized)
      vectorizer.value.addEventListener('message', _handlers.vectorized)
    if (gradienter.value && _handlers.gradientized)
      gradienter.value.addEventListener('message', _handlers.gradientized)
    if (tracer.value && _handlers.traced)
      tracer.value.addEventListener('message', _handlers.traced)
    if (optimizer.value && _handlers.optimized)
      optimizer.value.addEventListener('message', _handlers.optimized)

    workers_mounted.value = true
  }

  const unmount_workers = () => {
    if (!workers_mounted.value) return

    if (vectorizer.value) {
      if (_handlers.vectorized)
        vectorizer.value.removeEventListener('message', _handlers.vectorized)
      terminate_one(vectorizer)
    }
    if (gradienter.value) {
      if (_handlers.gradientized)
        gradienter.value.removeEventListener('message', _handlers.gradientized)
      terminate_one(gradienter)
    }
    if (tracer.value) {
      if (_handlers.traced)
        tracer.value.removeEventListener('message', _handlers.traced)
      terminate_one(tracer)
    }
    if (optimizer.value) {
      if (_handlers.optimized)
        optimizer.value.removeEventListener('message', _handlers.optimized)
      terminate_one(optimizer)
    }

    workers_mounted.value = false
  }

  return {
    vectorizer,
    gradienter,
    tracer,
    optimizer,
    workers_mounted,
    set_handlers,
    mount_workers,
    unmount_workers
  }
}
