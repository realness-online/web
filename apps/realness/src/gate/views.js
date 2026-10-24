/**
 * Each person's live chat view, held by the gate: who holds the pen, the
 * transcript as of their last commit, and its tail. Readers on any device
 * follow it; a device that takes the pen tells the old writer to stop.
 *
 * In memory: one gate process serves a person's devices.
 */

/**
 * @typedef {{ role: string, text: string, thinking?: string }} Line
 * @typedef {{ writer: string | null, tail: number, lines: Line[] }} View
 * @typedef {{ type: 'view', writer: string | null, tail: number, lines: Line[] } | { type: 'claimed', writer: string }} ViewRecord
 */

export const make_views = () => {
  /** @type {Map<string, View>} */
  const views = new Map()
  /** @type {Map<string, Set<(record: ViewRecord) => void>>} */
  const readers = new Map()

  const view_of = phone => {
    let view = views.get(phone)
    if (!view) {
      view = { writer: null, tail: 0, lines: [] }
      views.set(phone, view)
    }
    return view
  }
  const send = (phone, record) => {
    for (const reader of readers.get(phone) ?? []) reader(record)
  }

  return {
    /** @param {string} phone */
    current: phone => ({ type: 'view', ...view_of(phone) }),

    /**
     * Take the pen; every reader hears who holds it now.
     * @param {string} phone
     * @param {string} writer
     */
    claim(phone, writer) {
      view_of(phone).writer = writer
      send(phone, { type: 'claimed', writer })
    },

    /**
     * Publish the writer's committed transcript. A stale writer is refused.
     * @param {string} phone
     * @param {{ writer: string, tail: number, lines: Line[] }} update
     * @returns {boolean}
     */
    publish(phone, { writer, tail, lines }) {
      const view = view_of(phone)
      if (view.writer && view.writer !== writer) return false
      Object.assign(view, { writer, tail, lines })
      send(phone, { type: 'view', writer, tail, lines })
      return true
    },

    /**
     * Hear every claim and publish for one person until the returned stop.
     * @param {string} phone
     * @param {(record: ViewRecord) => void} reader
     */
    follow(phone, reader) {
      let set = readers.get(phone)
      if (!set) {
        set = new Set()
        readers.set(phone, set)
      }
      set.add(reader)
      return () => {
        set.delete(reader)
        if (!set.size) readers.delete(phone)
      }
    }
  }
}
