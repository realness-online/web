/**
 * @returns {{ lock: () => Promise<void>, unlock: () => void }}
 */
const create_mutex = () => {
  const state = {
    locked: false,
    queue: /** @type {Array<(value?: void) => void>} */ ([])
  }
  return {
    lock: async () => {
      if (state.locked)
        await new Promise(resolve => {
          state.queue.push(resolve)
        })
      else state.locked = true
    },
    unlock: () => {
      state.locked = false
      const next = state.queue.shift()
      if (next) next()
    }
  }
}

const mutexes = new Map()

/**
 * @param {string} resource
 * @returns {{ lock: () => Promise<void>, unlock: () => void }}
 */
export const mutex_for = resource => {
  if (!mutexes.has(resource)) mutexes.set(resource, create_mutex())
  return /** @type {{ lock: () => Promise<void>, unlock: () => void }} */ (
    mutexes.get(resource)
  )
}
