// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
/** @typedef {import('@/persistance/Storage').Storage} Storage */

/**
 * @template {new (...args: any[]) => Storage} T
 * @param {T} superclass
 * @returns {T}
 */
export const Local = superclass =>
  class extends superclass {
    save(items = document.querySelector(`[itemid="${this.id}"]`) ?? undefined) {
      if (items) localStorage.setItem(this.id, items.outerHTML)
    }
  }
