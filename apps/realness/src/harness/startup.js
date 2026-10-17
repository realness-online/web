/** Shared stage vocabulary; a stage is reported only by the code doing it. */
export const startup_stages = Object.freeze({
  checking_seed: 'Getting ready',
  starting_actor: 'Starting your computer',
  waiting_guest: 'Starting your computer',
  initializing_actor: 'Setting up your computer',
  restoring_files: 'Bringing back your files',
  starting_pi: 'Starting Pi',
  connecting_chat: 'Connecting',
  connecting_terminal: 'Connecting',
  starting_halo: 'Waking up'
})

/** @typedef {'complete' | 'failed' | 'cancelled'} StartupResult */
/**
 * @typedef {object} StartupEvent
 * @property {string} startup_id
 * @property {keyof typeof startup_stages} stage
 * @property {number} stage_index
 * @property {'starting' | StartupResult} state
 * @property {number} elapsed_ms
 * @property {number} [ms]
 * @property {string} [source] Source clocks and stage indexes remain separate.
 */

/**
 * Measure separate stage durations and elapsed operation time with one monotonic clock.
 * An external started_at must use the same clock origin.
 * @param {{id: string, report: (event: StartupEvent) => void, clock?: () => number, started_at?: number | null}} options
 */
/**
 * A startup trace: the id it was minted with, a `begin` that returns the
 * `finish` for one stage, and `run`, which wraps a stage's work.
 * @typedef {object} StartupTrace
 * @property {string} id
 * @property {(stage: string) => (state?: StartupResult) => void} begin
 * @property {(stage: string, work: () => Promise<unknown> | unknown, options?: object) => Promise<unknown>} run
 */

/**
 * @param {object} options
 * @param {string} options.id
 * @param {(fields: StartupEvent) => void} options.report
 * @param {() => number} [options.clock]
 * @param {number | null} [options.started_at]
 * @returns {StartupTrace}
 */
export const create_startup_trace = ({
  id,
  report,
  clock = () => performance.now(),
  started_at = null
}) => {
  const started = started_at ?? clock()
  let stage_index = 0
  /** @param {keyof typeof startup_stages} stage */
  const begin = stage => {
    if (!Object.hasOwn(startup_stages, stage))
      throw new Error(`Unknown startup stage: ${stage}`)
    const stage_started = clock()
    const fields = { startup_id: id, stage, stage_index: stage_index++ }
    report({
      ...fields,
      state: 'starting',
      elapsed_ms: stage_started - started
    })
    let ended = false
    /** @param {StartupResult} [state] */
    const finish = (state = 'complete') => {
      if (ended) return
      if (!['complete', 'failed', 'cancelled'].includes(state))
        throw new Error(`Unknown startup state: ${state}`)
      ended = true
      const now = clock()
      report({
        ...fields,
        state,
        ms: now - stage_started,
        elapsed_ms: now - started
      })
    }
    return finish
  }
  return {
    id,
    begin,
    /**
     * @template T
     * @param {keyof typeof startup_stages} stage
     * @param {() => Promise<T> | T} work
     * @param {{succeeded?: (result: T) => boolean}} [options]
     */
    async run(stage, work, { succeeded = () => true } = {}) {
      const finish = begin(stage)
      try {
        const result = await work()
        finish(succeeded(result) ? 'complete' : 'failed')
        return result
      } catch (error) {
        finish('failed')
        throw error
      }
    }
  }
}
