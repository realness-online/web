/** @typedef {import('@/persistance/Storage').Storage} Storage */

/**
 * Networkable mixin - provides the class structure for network operations
 * @template {new (...args: any[]) => Storage} T
 * @param {T} superclass
 * @returns {T}
 */
export const Networkable = superclass =>
  class extends superclass {
    constructor(...args) {
      super(...args)
    }
  }
