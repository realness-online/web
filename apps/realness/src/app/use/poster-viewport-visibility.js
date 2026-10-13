import {
  ref,
  onBeforeUnmount as on_before_unmount,
  toValue as to_value,
  watch
} from 'vue'
import { useIntersectionObserver as use_intersect } from '@vueuse/core'
import {
  INTERSECTION_THRESHOLDS,
  measure_visibility
} from '@/utils/intersection'

/**
 * Track coarse and full viewport visibility for a poster figure element.
 *
 * @param {import('vue').MaybeRefOrGetter<HTMLElement | null | undefined>} element_ref
 * @param {{ force_intersecting?: import('vue').MaybeRefOrGetter<boolean> }} [options]
 */
export const use_poster_viewport_visibility = (element_ref, options = {}) => {
  const intersecting = ref(false)
  const in_view = ref(false)

  const sync = () => {
    const el = to_value(element_ref)
    if (!el) {
      intersecting.value = false
      in_view.value = false
      return
    }
    const measured = measure_visibility(el)
    intersecting.value = measured.intersecting
    in_view.value = measured.in_view
  }

  let raf = 0
  const schedule_sync = () => {
    if (raf || !intersecting.value) return
    raf = requestAnimationFrame(() => {
      raf = 0
      sync()
    })
  }

  use_intersect(
    element_ref,
    ([entry]) => {
      intersecting.value = entry.isIntersecting
      if (!entry.isIntersecting) in_view.value = false
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

  if (options.force_intersecting)
    watch(
      () => to_value(options.force_intersecting),
      force => {
        if (force) intersecting.value = true
      },
      { immediate: true }
    )

  on_before_unmount(() => {
    if (raf) cancelAnimationFrame(raf)
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', schedule_sync, { capture: true })
      window.removeEventListener('resize', schedule_sync)
    }
  })

  return { intersecting, in_view, sync }
}
