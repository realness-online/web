export const mutex = {
  locked: false,
  queue: [],
  lock: async () => {
    if (mutex.locked)
      await new Promise(resolve => {
        mutex.queue.push(resolve)
      })
    else mutex.locked = true
  },
  unlock: () => {
    mutex.locked = false
    const next = mutex.queue.shift()
    if (next) next()
  }
}
