// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
/**
 * @template {new (...args: any[]) => any} T
 * @param {T} superclass
 * @returns {T}
 */
export const Local = superclass =>
  class extends superclass {
    constructor(...args) {
      super(...args)
    }

    /**
     * @param {Element | {outerHTML: string}} [items]
     */
    save(items = document.querySelector(`[itemid="${this.id}"]`) ?? undefined) {
      if (items) localStorage.setItem(this.id, items.outerHTML)
    }
  }
