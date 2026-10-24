import { existsSync as exists_sync, watch } from 'node:fs'

/**
 * Serialize builds: a save during a build schedules one more complete pass.
 * @param {() => Promise<void>} build
 * @returns {() => void} Stop watching.
 */
export const watch_sources = build => {
  /** @type {NodeJS.Timeout | null} */
  let pending = null
  let running = false
  let dirty = false
  const rebuild = async () => {
    if (running) {
      dirty = true
      return
    }
    running = true
    try {
      await build()
    } catch (error) {
      console.error(error.message)
    } finally {
      running = false
      if (dirty) {
        dirty = false
        schedule()
      }
    }
  }
  const schedule = () => {
    if (pending) clearTimeout(pending)
    pending = setTimeout(rebuild, 50)
  }
  const directories = ['content', 'static', 'partials', 'pages'].filter(exists_sync)
  const watchers = directories.map(directory => watch(directory, { recursive: true }, schedule))
  watchers.push(watch('site.json', schedule))
  return () => {
    if (pending) clearTimeout(pending)
    for (const watcher of watchers) watcher.close()
  }
}
