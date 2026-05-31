import { ref, onBeforeUnmount, toValue, watch } from 'vue'
import { useIntersectionObserver as use_intersect } from '@vueuse/core'
import {
  INTERSECTION_THRESHOLDS,
  measure_visibility
} from '@/utils/intersection'

/**
 * Track coarse and full viewport visibility for a poster figure element.
 *
 * @param {import('vue').MaybeRefOrGetter<HTMLElement | null | undefined>} element_ref
 * @param {{ force_in_view?: import('vue').MaybeRefOrGetter<boolean> }} [options]
 */
export const use_poster_viewport_visibility = (element_ref, options = {}) => {
  const in_view = ref(false)
  const fully_in_view = ref(false)

  const sync = () => {
    const el = toValue(element_ref)
    if (!el) {
      in_view.value = false
      fully_in_view.value = false
      return
    }
    const measured = measure_visibility(el)
    in_view.value = measured.in_view
    fully_in_view.value = measured.fully_in_view
  }

  let raf = 0
  const schedule_sync = () => {
    if (raf || !in_view.value) return
    raf = requestAnimationFrame(() => {
      raf = 0
      sync()
    })
  }

  use_intersect(
    element_ref,
    ([entry]) => {
      in_view.value = entry.isIntersecting
      if (!entry.isIntersecting) fully_in_view.value = false
      else sync()
    },
    { threshold: INTERSECTION_THRESHOLDS }
  )

  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', schedule_sync, {
      passive: true,
      capture: true
    })
    window.addEventListener('resize', schedule_sync, { passive: true })
  }

  if (options.force_in_view)
    watch(
      () => toValue(options.force_in_view),
      force => {
        if (force) in_view.value = true
      },
      { immediate: true }
    )

  onBeforeUnmount(() => {
    if (raf) cancelAnimationFrame(raf)
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', schedule_sync, { capture: true })
      window.removeEventListener('resize', schedule_sync)
    }
  })

  return { in_view, fully_in_view, sync }
}
