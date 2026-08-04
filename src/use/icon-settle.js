import { ref } from 'vue'

/**
 * @param {EventTarget | null} target
 * @param {string} part
 */
const is_part = (target, part) =>
  target instanceof Element && target.classList.contains(part)

/**
 * A hover that ends deserves a flourish on the way out, and CSS has no leave
 * animation to hang one on. So the label carries data-settling for as long as
 * that flourish runs, and drops it when the animation says it is done.
 *
 * @param {Object} until Which animationend ends the settle
 * @param {string} until.animation Keyframe name to wait for
 * @param {string} [until.part] Class of the part that finishes last, for icons
 *   whose pieces share one keyframe on a stagger
 */
export const use_icon_settle = ({ animation, part }) => {
  const hovered = ref(false)
  const settling = ref(false)

  const enter = () => {
    hovered.value = true
    settling.value = false
  }

  /** Clear, then set on the next frame, so a second leave replays the
      flourish rather than joining one already running. */
  const leave = () => {
    if (!hovered.value) return
    hovered.value = false
    settling.value = false
    requestAnimationFrame(() => {
      settling.value = true
    })
  }

  /** @param {AnimationEvent} event */
  const end = event => {
    if (event.animationName !== animation) return
    if (part && !is_part(event.target, part)) return
    settling.value = false
  }

  return { settling, enter, leave, end }
}
