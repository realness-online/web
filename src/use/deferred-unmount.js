import { computed, onScopeDispose, ref, watch } from 'vue'

/** A frame or two past the transition, so the timer never lands early. */
const SLACK = 50

export const MS_PER_SECOND = 1000

/**
 * Read a duration constant from motion.css, in milliseconds. Keeps the hold
 * and the transition on the same number instead of hard-coding a second copy.
 *
 * @param {string} name Custom property name, e.g. '--duration-subject'
 * @returns {number}
 */
export const duration_of = name => {
  const root = globalThis.document?.documentElement
  if (!root) return 0
  const value = getComputedStyle(root).getPropertyValue(name).trim()
  if (!value) return 0
  const amount = Number.parseFloat(value)
  if (Number.isNaN(amount)) return 0
  return value.endsWith('ms') ? amount : amount * MS_PER_SECOND
}

/**
 * Hold a node past the moment its preference goes off, so the exit has time to
 * animate before the DOM shrinks back.
 *
 * Some subtrees are removed deliberately - five masked `use` elements measured
 * ~29fps against ~59 - so keeping them mounted forever is not an option. This
 * keeps the removal, and only moves the moment of it: the key leaves the set
 * one transition later instead of on the same frame.
 *
 * Not Vue's `<Transition>`, which injects `v-enter-active` classes that
 * realness-design forbids.
 *
 * @param {() => string[]} source Keys that should be shown right now
 * @param {Object} [options]
 * @param {string} [options.duration] Motion constant to hold for
 * @param {number | (() => number)} [options.steps] Stagger steps to allow for,
 *   if the exit is staggered across siblings. A function is asked at the
 *   moment of the hold, for a stagger that only some exits carry - a fixed
 *   count would keep every other exit mounted for a wait it never took.
 * @returns {{ keys: import('vue').ComputedRef<string[]>,
 *             leaving: import('vue').Ref<Set<string>>,
 *             end: (key: string) => void }}
 */
export const use_deferred_unmount = (
  source,
  { duration = '--duration-subject', steps = 0 } = {}
) => {
  /** @type {import('vue').Ref<Set<string>>} */
  const leaving = ref(new Set())
  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  const timers = new Map()

  const forget = key => {
    clearTimeout(timers.get(key))
    timers.delete(key)
    if (!leaving.value.has(key)) return
    const next = new Set(leaving.value)
    next.delete(key)
    leaving.value = next
  }

  // The transition may never fire - the node can be offscreen, or already
  // display: none - so the timer is the one that always lands, and
  // transitionend only gets to be early.
  const hold = key => {
    clearTimeout(timers.get(key))
    const waiting = typeof steps === 'function' ? steps() : steps
    timers.set(
      key,
      setTimeout(
        () => forget(key),
        duration_of(duration) + duration_of('--stagger-step') * waiting + SLACK
      )
    )
  }

  watch(
    source,
    (now, before = []) => {
      const showing = new Set(now)
      const next = new Set(leaving.value)

      for (const key of before) {
        if (showing.has(key)) continue
        next.add(key)
        hold(key)
      }
      for (const key of showing) {
        if (!next.has(key)) continue
        next.delete(key)
        clearTimeout(timers.get(key))
        timers.delete(key)
      }
      leaving.value = next
    },
    { immediate: true }
  )

  const keys = computed(() => [...new Set([...source(), ...leaving.value])])

  // A poster scrolled away mid-transition must not leak a held node.
  onScopeDispose(() => {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
  }, true)

  return { keys, leaving, end: forget }
}

/**
 * The single-node form: one flag that stays true through the exit.
 *
 * For a node that must keep unmounting - an async component whose chunk should
 * stay lazy, an expensive subtree - where display: none alone is not enough.
 *
 * @param {() => boolean} source Whether it should be shown right now
 * @param {Object} [options]
 * @param {string} [options.duration] Motion constant to hold for
 * @param {number} [options.steps] Stagger steps to allow for, if the exit is
 *   staggered across siblings
 * @returns {{ mounted: import('vue').ComputedRef<boolean>,
 *             leaving: import('vue').ComputedRef<boolean>,
 *             end: () => void }}
 */
export const use_deferred_flag = (source, options) => {
  const held = use_deferred_unmount(() => (source() ? ['on'] : []), options)

  return {
    mounted: computed(() => held.keys.value.length > 0),
    leaving: computed(() => held.leaving.value.has('on')),
    end: () => held.end('on')
  }
}
