/**
 * The base every store class extends. `type` is derived from the itemid with the
 * store's vocabulary, never stored.
 * @param {{ as_type: (itemid: string) => string | null }} config
 */
export const create_storage = ({ as_type }) =>
  class Storage {
    metadata = { contentType: 'text/html' }

    /**
     * @param {string} itemid
     */
    constructor(itemid) {
      this.id = itemid
      this.type = as_type(itemid)
    }

    /**
     * @param {Element | {outerHTML: string} | null} [items]
     */
    save(items) {}
    delete() {}
    /**
     * @returns {Promise<object[]>}
     */
    sync() {
      return Promise.resolve([])
    }
    optimize() {}
  }
