import { watch } from 'vue'
import { duration_of, MS_PER_SECOND } from '@/use/deferred-unmount'

/** Below this the fade is not worth running - reduced motion collapses the
    motion constants to a hair, and SMIL with a near-zero dur just flickers. */
const TOO_SHORT = 20

/**
 * Transition an attribute that CSS cannot reach.
 *
 * A `<path>` inside `<symbol>` defs is never rendered, so a CSS transition on
 * it never starts - the `<use>` instance only mirrors the final value. SMIL
 * does run in defs, which is how as-animation already drives these same paths.
 *
 * The attribute underneath keeps carrying the resting value, so a serialized
 * export is unaffected; the animation only covers the crossing.
 *
 * @param {import('vue').Ref<SVGAnimateElement | null>} element The `<animate>`
 * @param {() => number} target Value to settle on
 * @param {Object} [options]
 * @param {string} [options.duration] Motion constant to fade over
 */
export const use_smil_fade = (
  element,
  target,
  { duration = '--duration-subject' } = {}
) => {
  watch(target, (to, from) => {
    const animate = element.value
    if (!animate || from === undefined) return

    const ms = duration_of(duration)
    if (ms < TOO_SHORT) return

    animate.setAttribute('values', `${from};${to}`)
    animate.setAttribute('dur', `${ms / MS_PER_SECOND}s`)
    animate.beginElement()
  })
}
